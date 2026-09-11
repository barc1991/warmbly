// Package inboxagent implements the inbox agent (M10): a paid, opt-in feature
// that drafts a suggested reply when an inbound HUMAN reply lands, persists it
// awaiting a human Approve-and-send / Edit / Discard in the unibox, and never
// sends on its own. It runs in the consumer (where inbound replies are ingested)
// off the advanced-outreach reply hook, on a detached context so it never blocks
// reply processing.
package inboxagent

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/warmbly/warmbly/internal/app/credits"
	"github.com/warmbly/warmbly/internal/app/emailsend"
	"github.com/warmbly/warmbly/internal/app/feature"
	"github.com/warmbly/warmbly/internal/app/replyclassify"
	"github.com/warmbly/warmbly/internal/app/unibox"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/pkg/generation"
	"github.com/warmbly/warmbly/internal/pkg/leadnormalize"
	"github.com/warmbly/warmbly/internal/repository"
)

// draftTimeout bounds the whole draft (thread fetch + one completion) on the
// detached background context.
const draftTimeout = 45 * time.Second

// maxThreadMessages caps how much thread history grounds the draft.
const maxThreadMessages = 20

// OrgReader reads the org for its opt-in flag + voice profile.
type OrgReader interface {
	GetByID(ctx context.Context, id uuid.UUID) (*models.Organization, error)
}

// ThreadReader loads a thread's messages for grounding (repository.UniboxRepository).
// GroundingByThread carries the message text, not the preview line: a draft
// written against the first hundred characters of each email answers the
// greeting and misses the question.
type ThreadReader interface {
	GroundingByThread(ctx context.Context, orgID uuid.UUID, threadID string, limit int) ([]models.MessageGrounding, error)
}

// SkillsSource optionally contributes the org's enabled skills preamble.
type SkillsSource interface {
	EnabledPreamble(ctx context.Context, orgID uuid.UUID) string
}

// ContactStore optionally grounds the draft in the counterpart contact's CRM
// record (name, company, custom fields) and backfills missing fields from signatures.
// Satisfied by repository.ContactRepository.
type ContactStore interface {
	GetByID(ctx context.Context, contactID uuid.UUID) (*models.Contact, *errx.Error)
	GetByEmailAndOrganization(ctx context.Context, organizationID uuid.UUID, email string) (*models.Contact, *errx.Error)
	Update(ctx context.Context, userID, contactID string, orgID uuid.UUID, data *models.UpdateContact) (*models.Contact, *errx.Error)
}

// DraftPublisher emits the AI_DRAFT_READY realtime event (*pubsub.StreamingPublisher).
type DraftPublisher interface {
	PublishAIDraftReady(ctx context.Context, orgID, actorID uuid.UUID, threadID, draftID, emailID string)
}

// BDRSettingsReader loads BDR settings for the org.
type BDRSettingsReader interface {
	GetBDRSettings(ctx context.Context, orgID uuid.UUID) (*models.BDRSettings, error)
}

// MailboxReader gets mailbox details (e.g. signature).
type MailboxReader interface {
	GetByID(ctx context.Context, emailAccountID uuid.UUID) (*models.Email, *errx.Error)
}

// AutoSender dispatches emails directly when auto-send is permitted.
type AutoSender interface {
	SendEmail(ctx context.Context, userID, orgID, emailAccountID uuid.UUID, req *emailsend.SendEmailRequest) (*emailsend.SendEmailResponse, *errx.Error)
}

// Service is the inbox agent. DraftForReply is the single entry point, called
// best-effort from the reply hook; it fans the actual work onto its own
// goroutine + context, so a slow model never stalls inbound-reply processing.
type Service interface {
	DraftForReply(ctx context.Context, r models.InboxAgentReply)
	SetBDRComponents(bdr BDRSettingsReader, mailboxes MailboxReader, sender AutoSender)
}

type service struct {
	provider   generation.Provider
	credits    credits.CreditService
	feature    feature.FeatureGateService
	orgs       OrgReader
	threads    ThreadReader
	skills     SkillsSource
	contacts   ContactStore
	draftRepo  repository.AIDraftRepository
	publisher  DraftPublisher
	bdrReader  BDRSettingsReader
	mailboxes  MailboxReader
	autoSender AutoSender
}

// NewService builds the inbox agent. A nil provider, credit service, org reader,
// thread reader, or draft repo disables it (DraftForReply becomes a no-op);
// skills + publisher are optional.
func NewService(
	provider generation.Provider,
	creditSvc credits.CreditService,
	featureGate feature.FeatureGateService,
	orgs OrgReader,
	threads ThreadReader,
	skills SkillsSource,
	contacts ContactStore,
	draftRepo repository.AIDraftRepository,
	publisher DraftPublisher,
) Service {
	return &service{
		provider:  provider,
		credits:   creditSvc,
		feature:   featureGate,
		orgs:      orgs,
		threads:   threads,
		skills:    skills,
		contacts:  contacts,
		draftRepo: draftRepo,
		publisher: publisher,
	}
}

func (s *service) SetBDRComponents(bdr BDRSettingsReader, mailboxes MailboxReader, sender AutoSender) {
	s.bdrReader = bdr
	s.mailboxes = mailboxes
	s.autoSender = sender
}

// DraftForReply kicks off drafting on a detached context so the caller (inbound
// reply processing) never blocks on the model. All work is best-effort.
func (s *service) DraftForReply(_ context.Context, r models.InboxAgentReply) {
	if s.provider == nil || s.credits == nil || s.orgs == nil || s.threads == nil || s.draftRepo == nil {
		return
	}
	if r.OrganizationID == uuid.Nil || r.ThreadID == "" || r.Counterpart == "" {
		return
	}
	go func() {
		// The draft path is best-effort and must never take down reply ingest: a
		// panic anywhere in it (provider, repo, publisher) is contained here.
		defer func() {
			if rec := recover(); rec != nil {
				log.Error().Interface("panic", rec).Str("thread_id", r.ThreadID).Msg("inbox agent: draft pipeline panicked")
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), draftTimeout)
		defer cancel()
		s.draft(ctx, r)
	}()
}

// draft runs the full pipeline: entitlement + opt-in, dedupe, balance pre-check,
// generate, reserve (insert), charge, publish. It charges only after a draft row
// is reserved, and unwinds the row if the charge fails, so an org is never
// charged for a draft it did not receive.
func (s *service) draft(ctx context.Context, r models.InboxAgentReply) {
	// Paid entitlement.
	if allowed, ferr := s.feature.CanUseInboxAgent(ctx, r.OrganizationID); ferr != nil || !allowed {
		return
	}
	// Per-org opt-in + voice grounding come from the org row.
	org, oerr := s.orgs.GetByID(ctx, r.OrganizationID)
	if oerr != nil || org == nil || !org.InboxAgentEnabled {
		return
	}

	// A trivial ack ("thanks", "ok, got it") does not warrant a paid reply
	// draft. Reuse the classifier's content-sanity gate so an org isn't charged
	// 5 credits to reply to one-liners.
	replyText := r.BodyText
	if strings.TrimSpace(replyText) == "" {
		replyText = r.Snippet
	}
	if !replyclassify.WorthModeling(replyclassify.Input{BodyText: replyText}) {
		return
	}

	// Dedupe: never draft twice for the same inbound message, and at most one
	// pending draft per thread. Cheap pre-check before any model spend.
	src := &r.SourceMessageID
	if r.SourceMessageID == uuid.Nil {
		src = nil
	}
	if has, herr := s.draftRepo.HasActiveDraft(ctx, r.OrganizationID, r.ThreadID, src); herr != nil || has {
		return
	}

	// Balance + abuse-cap pre-check so a broke/capped org never does free model
	// work (the charge itself is enforced again below).
	if bal, berr := s.credits.GetBalance(ctx, r.OrganizationID); berr != nil || bal < credits.CostInboxAgentThread {
		return
	}
	if err := s.credits.CheckUsageCaps(ctx, r.OrganizationID); err != nil {
		return
	}

	// Ground the draft in the thread history + org voice + enabled skills.
	history := s.threadHistory(ctx, r.OrganizationID, r.ThreadID)
	if history == "" {
		return
	}
	voice := generation.VoiceContext{
		ProductDescription: org.ProductDescription,
		ICPNotes:           org.ICPNotes,
		VoiceProfile:       org.VoiceProfile,
	}
	if generation.ContainsHebrew(history) || generation.ContainsHebrew(r.Subject) {
		voice.Language = "he"
	}
	system := generation.BuildReplyRules(voice)
	if s.skills != nil {
		if pre := s.skills.EnabledPreamble(ctx, r.OrganizationID); pre != "" {
			system += "\n\n" + pre
		}
	}

	// BDR Settings & Inbound Analysis with Gemini
	var bdr *models.BDRSettings
	if s.bdrReader != nil {
		bdr, _ = s.bdrReader.GetBDRSettings(ctx, r.OrganizationID)
	}

	analysis, _ := AnalyzeInboundEmail(ctx, s.provider, r.Subject, replyText, r.Counterpart)
	if analysis == nil {
		analysis = &InboundAnalysisResult{
			IntentClass: r.IntentClass,
			Confidence:  r.Confidence,
		}
	}
	if analysis.IntentClass == "" {
		analysis.IntentClass = r.IntentClass
	}
	if analysis.Confidence == 0 {
		analysis.Confidence = r.Confidence
	}

	// Enrich missing contact fields from inbound reply analysis (signature name, phone, website, company, job title)
	s.enrichContactFromReply(ctx, r.OrganizationID, r.OwnerUserID, r.ContactID, r.Counterpart, analysis)

	var researchNotesBuilder strings.Builder
	if analysis.Rationale != "" {
		researchNotesBuilder.WriteString("Intent Rationale: ")
		researchNotesBuilder.WriteString(analysis.Rationale)
		researchNotesBuilder.WriteString("\n")
	}
	if analysis.KeyInsight != "" {
		researchNotesBuilder.WriteString("Key Insight: ")
		researchNotesBuilder.WriteString(analysis.KeyInsight)
		researchNotesBuilder.WriteString("\n")
	}
	if bdr != nil && bdr.FirstReplyWebsiteCrawl {
		webText, _ := InspectWebsiteForFirstReply(ctx, r.Counterpart, analysis.SignatureWeb)
		if webText != "" {
			researchNotesBuilder.WriteString("Website Research:\n")
			researchNotesBuilder.WriteString(webText)
			researchNotesBuilder.WriteString("\n")
		}
	}
	researchNotes := strings.TrimSpace(researchNotesBuilder.String())
	if researchNotes != "" {
		system += "\n\nLead Research Notes:\n" + researchNotes
	}

	model := s.provider.ModelForTier(true) // inbox agent is paid-only
	res, gerr := s.provider.Complete(ctx, generation.CompletionRequest{
		System: system,
		Prompt: buildReplyPrompt(history, s.contactGrounding(ctx, r.ContactID)),
		Model:  model,
	})
	if gerr != nil || res == nil || strings.TrimSpace(res.Text) == "" {
		return
	}

	// Deliverability & Spam Guardrail
	var mailboxSignature string
	if s.mailboxes != nil && r.EmailAccountID != uuid.Nil {
		if mb, mberr := s.mailboxes.GetByID(ctx, r.EmailAccountID); mberr == nil && mb != nil {
			mailboxSignature = mb.SignaturePlain
		}
	}
	cleanBody, sErr := DeliverabilitySpamGuardrail(res.Text, mailboxSignature)
	if sErr != nil {
		log.Warn().Err(sErr).Str("thread_id", r.ThreadID).Msg("inbox agent: draft triggered spam guardrail, keeping raw body without auto-send")
		cleanBody = strings.TrimSpace(res.Text)
	}

	// Reserve the draft row (the partial unique indexes enforce dedupe under a
	// race). Only after a successful reserve do we charge.
	draft := &models.AIThreadDraft{
		OrganizationID:  r.OrganizationID,
		EmailAccountID:  r.EmailAccountID,
		OwnerUserID:     r.OwnerUserID,
		ThreadID:        r.ThreadID,
		SourceMessageID: src,
		ToAddr:          r.Counterpart,
		Subject:         replySubject(r.Subject),
		InReplyTo:       r.InReplyTo,
		Body:            cleanBody,
		IntentClass:     analysis.IntentClass,
		Confidence:      analysis.Confidence,
		Model:           res.Model,
		Status:          models.AIDraftPending,
		ResearchNotes:   researchNotes,
		SignatureData:   analysis.SignatureRaw,
	}
	if r.ContactID != uuid.Nil {
		draft.ContactID = &r.ContactID
	}
	if r.CampaignID != uuid.Nil {
		draft.CampaignID = &r.CampaignID
	}
	if cerr := s.draftRepo.CreateDraft(ctx, draft); cerr != nil {
		// ErrDraftExists => another run/existing draft won the race; anything else
		// is a store failure. Either way: no charge, no draft delivered.
		return
	}

	// Charge exactly once (idempotency key = the draft id, unique per reserve).
	// If the charge fails (out of credits at charge time, or a cap trip), unwind
	// the reserved row so no free draft lingers. Delete on a FRESH context: the
	// draft ctx may be near its deadline after a slow completion, and a failed
	// delete would orphan an unpaid pending draft that could later be
	// approved-and-sent for free. A free/local model (AI_FREE) runs
	// un-metered, so skip the charge (and the unwind).
	if !s.provider.IsLocal() {
		ctx = models.WithCreditMeta(ctx, models.CreditMeta{Context: models.CreditContext{ThreadID: r.ThreadID, Detail: "inbound from " + r.Counterpart}})
		if _, chErr := s.credits.Consume(ctx, r.OrganizationID, credits.CostInboxAgentThread, "inbox_agent_draft", res.Model, res.TokensUsed, "inbox_agent:"+draft.ID.String()); chErr != nil {
			delCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if derr := s.draftRepo.DeleteDraft(delCtx, draft.ID); derr != nil {
				log.Error().Err(derr).Str("draft_id", draft.ID.String()).Msg("inbox agent: failed to unwind unpaid draft after credit charge failure")
			}
			return
		}
		// Usage-based settle: charge any overage beyond the flat thread price
		// from the run's actual tokens (best-effort; the draft stands).
		_, _ = s.credits.SettleUsage(ctx, r.OrganizationID, credits.CostInboxAgentThread, res.Model, res.TokensUsed, "inbox_agent_draft", "inbox_agent:"+draft.ID.String()+":usage")
	}

	// Autonomous send when permitted by BDR settings, confidence threshold met, and spam check passed.
	if bdr != nil && bdr.InboxAutoSendEnabled && s.autoSender != nil && sErr == nil {
		threshold := bdr.InboxAutoSendMinConfidence
		if threshold <= 0 {
			threshold = 0.85
		}
		canAutoSendIntent := analysis.IntentClass == "INTERESTED" || analysis.IntentClass == "MEETING_REQUEST"
		if canAutoSendIntent && analysis.Confidence >= threshold {
			claimed, cErr := s.draftRepo.SetDraftStatus(ctx, r.OrganizationID, draft.ID, models.AIDraftApproved)
			if cErr == nil && claimed {
				sendReq := &emailsend.SendEmailRequest{
					To:        []string{draft.ToAddr},
					Subject:   draft.Subject,
					BodyPlain: draft.Body,
					ThreadID:  draft.ThreadID,
					SendMode:  "instant",
				}
				if draft.InReplyTo != "" {
					sendReq.InReplyTo = []string{draft.InReplyTo}
				}
				_, sendErr := s.autoSender.SendEmail(ctx, r.OwnerUserID, r.OrganizationID, r.EmailAccountID, sendReq)
				if sendErr != nil {
					log.Error().Err(sendErr).Str("draft_id", draft.ID.String()).Msg("inbox agent: auto-send failed, reverting to pending")
					_, _ = s.draftRepo.RevertApprovedToPending(ctx, r.OrganizationID, draft.ID)
				} else {
					draft.Status = models.AIDraftApproved
					log.Info().Str("draft_id", draft.ID.String()).Str("to", draft.ToAddr).Msg("inbox agent: autonomously sent reply")
				}
			}
		}
	}

	// Live: the whole team sees the draft land on the thread awaiting review. The
	// source id is optional (the event routes on org_id/thread_id); render it
	// nil-safely — src is nil when the inbound message had no stored id.
	emailID := ""
	if src != nil {
		emailID = src.String()
	}
	if s.publisher != nil {
		s.publisher.PublishAIDraftReady(ctx, r.OrganizationID, uuid.Nil, r.ThreadID, draft.ID.String(), emailID)
	}
}

// threadHistory renders the thread's messages oldest-first for grounding.
func (s *service) threadHistory(ctx context.Context, orgID uuid.UUID, threadID string) string {
	msgs, err := s.threads.GroundingByThread(ctx, orgID, threadID, maxThreadMessages)
	if err != nil || len(msgs) == 0 {
		return ""
	}
	return unibox.RenderGrounding(msgs)
}

func buildReplyPrompt(history, contactCtx string) string {
	var b strings.Builder
	b.WriteString("Thread so far (oldest first):\n\n")
	b.WriteString(history)
	if contactCtx != "" {
		b.WriteString("\n\n")
		b.WriteString(contactCtx)
	}
	b.WriteString("\n\nWrite a reply to the most recent message in this thread. Keep it natural and specific to what they said.")
	return b.String()
}

// contactGrounding renders a compact CRM block for the counterpart contact
// (name, company, known custom fields), or "" when there is no contact or no
// reader wired. Best-effort: a lookup failure just drops the grounding.
func (s *service) contactGrounding(ctx context.Context, contactID uuid.UUID) string {
	if s.contacts == nil || contactID == uuid.Nil {
		return ""
	}
	c, err := s.contacts.GetByID(ctx, contactID)
	if err != nil || c == nil {
		return ""
	}
	var b strings.Builder
	if name := strings.TrimSpace(c.FirstName + " " + c.LastName); name != "" {
		b.WriteString("Contact: ")
		b.WriteString(name)
		if c.Company != "" {
			b.WriteString(" at ")
			b.WriteString(c.Company)
		}
		b.WriteString("\n")
	}
	if len(c.CustomFields) > 0 {
		parts := make([]string, 0, len(c.CustomFields))
		for k, v := range c.CustomFields {
			if k = strings.TrimSpace(k); k != "" && strings.TrimSpace(v) != "" {
				parts = append(parts, k+": "+v)
			}
		}
		if len(parts) > 0 {
			b.WriteString("Known details: ")
			b.WriteString(strings.Join(parts, ", "))
			b.WriteString("\n")
		}
	}
	return strings.TrimSpace(b.String())
}

// replySubject prefixes "Re: " once, mirroring a normal reply subject.
func replySubject(subject string) string {
	s := strings.TrimSpace(subject)
	if s == "" {
		return "Re:"
	}
	if strings.HasPrefix(strings.ToLower(s), "re:") {
		return s
	}
	return "Re: " + s
}

// enrichContactFromReply fills in missing/empty fields on a contact using signature data
// and domain info extracted by Gemini, without overwriting existing data ("enrich, never erase").
func (s *service) enrichContactFromReply(ctx context.Context, orgID, ownerUserID uuid.UUID, contactID uuid.UUID, counterpartEmail string, analysis *InboundAnalysisResult) {
	if s.contacts == nil || analysis == nil {
		return
	}

	var contact *models.Contact
	var err *errx.Error

	if contactID != uuid.Nil {
		contact, err = s.contacts.GetByID(ctx, contactID)
	}
	if (contact == nil || err != nil) && counterpartEmail != "" && orgID != uuid.Nil {
		contact, _ = s.contacts.GetByEmailAndOrganization(ctx, orgID, counterpartEmail)
	}
	if contact == nil {
		return
	}

	var needsUpdate bool
	upd := &models.UpdateContact{}

	// 1. Name enrichment: parse and normalize if contact lacks first or last name
	rawFirst := strings.TrimSpace(analysis.SignatureFirstName)
	rawLast := strings.TrimSpace(analysis.SignatureLastName)
	if rawFirst == "" && rawLast == "" && strings.TrimSpace(analysis.SignatureName) != "" {
		parts := strings.Fields(strings.TrimSpace(analysis.SignatureName))
		if len(parts) == 1 {
			rawFirst = parts[0]
		} else if len(parts) > 1 {
			rawFirst = parts[0]
			rawLast = strings.Join(parts[1:], " ")
		}
	}

	if (contact.FirstName == "" || contact.LastName == "") && (rawFirst != "" || rawLast != "") {
		normalized := leadnormalize.NormalizeContactName(rawFirst, rawLast, analysis.SignatureComp, analysis.SignatureTitle)
		if contact.FirstName == "" && normalized.FirstName != "" {
			upd.FirstName = &normalized.FirstName
			needsUpdate = true
		}
		if contact.LastName == "" && normalized.LastName != "" {
			upd.LastName = &normalized.LastName
			needsUpdate = true
		}
	}

	// 2. Company enrichment
	if contact.Company == "" && strings.TrimSpace(analysis.SignatureComp) != "" {
		comp := leadnormalize.CleanCorporateName(analysis.SignatureComp)
		if comp != "" {
			upd.Company = &comp
			needsUpdate = true
		}
	}

	// 3. Phone enrichment
	if contact.Phone == "" && strings.TrimSpace(analysis.SignaturePhone) != "" {
		phone := strings.TrimSpace(analysis.SignaturePhone)
		if phone != "" {
			upd.Phone = &phone
			needsUpdate = true
		}
	}

	// 4. Custom fields (website, job_title)
	cf := make(map[string]string)
	if contact.CustomFields != nil {
		for k, v := range contact.CustomFields {
			cf[k] = v
		}
	}

	// Website from signature or corporate email domain
	currentWeb := strings.TrimSpace(cf["website"])
	if currentWeb == "" {
		targetWeb := strings.TrimSpace(analysis.SignatureWeb)
		if targetWeb == "" && counterpartEmail != "" && strings.Contains(counterpartEmail, "@") {
			parts := strings.Split(counterpartEmail, "@")
			domain := parts[len(parts)-1]
			if !isGenericEmailDomain(domain) {
				targetWeb = "https://" + domain
			}
		}
		if targetWeb != "" {
			if !strings.HasPrefix(targetWeb, "http://") && !strings.HasPrefix(targetWeb, "https://") {
				targetWeb = "https://" + targetWeb
			}
			cf["website"] = targetWeb
			needsUpdate = true
		}
	}

	// Job Title from signature
	currentTitle := strings.TrimSpace(cf["job_title"])
	if currentTitle == "" && strings.TrimSpace(analysis.SignatureTitle) != "" {
		cf["job_title"] = strings.TrimSpace(analysis.SignatureTitle)
		needsUpdate = true
	}

	if needsUpdate {
		upd.CustomFields = &cf
		userIDStr := ""
		if ownerUserID != uuid.Nil {
			userIDStr = ownerUserID.String()
		}
		if _, uerr := s.contacts.Update(ctx, userIDStr, contact.ID.String(), orgID, upd); uerr != nil {
			log.Warn().Err(uerr).Str("contact_id", contact.ID.String()).Msg("inbox agent: failed to auto-enrich contact fields")
		} else {
			log.Info().Str("contact_id", contact.ID.String()).Msg("inbox agent: successfully auto-enriched missing contact fields from reply")
		}
	}
}
