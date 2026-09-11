package aitools

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/app/webhook"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/pkg/generation"
	"github.com/warmbly/warmbly/internal/pkg/leadnormalize"
	"github.com/warmbly/warmbly/internal/pkg/safehttp"
)

func (d Deps) registerBDRTools(r *Registry) {
	r.Register(Tool{
		Name:        "serper_google_search",
		Description: "Search Google via Serper to research businesses, competitors, and market presence. Returns organic search results and Google Ads copy. Backed by multi-key rotation and 7-day query caching.",
		InputSchema: objectSchema(map[string]any{
			"query": strProp("Search query (e.g. company name, industry + location)."),
			"limit": intProp("Max results (1-20, default 10)."),
		}, "query"),
		Risk:    generation.RiskRead,
		Handler: d.serperGoogleSearch,
	})

	r.Register(Tool{
		Name:        "fetch_url_content",
		Description: "Scrape and crawl a lead's website (homepage, About Us, Contact, Services). Strips tags and returns clean structured text with strict SSRF protection and 7s timeout.",
		InputSchema: objectSchema(map[string]any{
			"url":              strProp("The website URL to fetch (https required)."),
			"include_subpages": boolProp("Whether to automatically discover and crawl /about and /contact subpages (default true)."),
		}, "url"),
		Risk:    generation.RiskRead,
		Handler: d.fetchURLContent,
	})

	r.Register(Tool{
		Name:        "update_lead_fields",
		Description: "Enrich and update contact card fields in the workspace. Automatically normalizes corporate suffixes (such as בע\"מ, LTD, LLC) to produce clean first names for {{firstName}} personalization.",
		InputSchema: objectSchema(map[string]any{
			"contact_id":        strProp("Contact UUID in Warmbly."),
			"email":             strProp("Optional contact email if contact_id is unknown."),
			"first_name":        strProp("Clean first name for personalization."),
			"last_name":         strProp("Clean last name."),
			"company_name":      strProp("Clean business/company name."),
			"job_title":         strProp("Job title or role (e.g. CEO, Marketing Director)."),
			"phone":             strProp("Phone number."),
			"city":              strProp("City."),
			"address":           strProp("Business address."),
			"website":           strProp("Business website URL."),
			"ai_research_notes": strProp("Concise business profile: what they do, key offerings, and advertising/growth pain points."),
		}),
		Risk:            generation.RiskWrite,
		RequiredOrgPerm: models.PermManageContacts,
		RequiredAPIPerm: models.APIPermWriteContacts,
		Handler:         d.updateLeadFields,
	})

	r.Register(Tool{
		Name:        "frappe_crm_sync",
		Description: "Sync an enriched lead to Frappe CRM with automatic deduplication by email. Updates existing lead or creates new, stores frappe_lead_id, and optionally schedules a task or calendar event.",
		InputSchema: objectSchema(map[string]any{
			"contact_id":       strProp("Contact UUID in Warmbly."),
			"task_title":       strProp("Optional CRM task title (e.g. 'Follow up with lead')."),
			"task_description": strProp("Optional CRM task details."),
			"task_due_date":    strProp("Optional task due date (YYYY-MM-DD or RFC3339)."),
			"event_title":      strProp("Optional calendar meeting/event title."),
			"event_start":      strProp("Optional meeting start time (RFC3339)."),
			"event_end":        strProp("Optional meeting end time (RFC3339)."),
		}, "contact_id"),
		Risk:            generation.RiskWrite,
		RequiredOrgPerm: models.PermManageContacts,
		RequiredAPIPerm: models.APIPermWriteContacts,
		Handler:         d.frappeCRMSync,
	})

	r.Register(Tool{
		Name:        "mark_do_not_contact",
		Description: "Mark a contact as Unsubscribed / Do Not Contact (DNC), remove from all active outreach campaigns, add to suppression list, and update Frappe CRM status.",
		InputSchema: objectSchema(map[string]any{
			"contact_id": strProp("Contact UUID to suppress."),
			"reason":     strProp("Reason for suppression (e.g. 'unsubscribed', 'not interested', 'spam complaint')."),
		}, "contact_id"),
		Risk:            generation.RiskWrite,
		RequiredOrgPerm: models.PermManageContacts,
		RequiredAPIPerm: models.APIPermWriteContacts,
		Handler:         d.markDoNotContact,
	})
}

func (d Deps) serperGoogleSearch(ctx context.Context, inv Invocation, args json.RawMessage) (string, error) {
	in, err := decodeArgs[struct {
		Query string `json:"query"`
		Limit int    `json:"limit"`
	}](args)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(in.Query) == "" {
		return "", ErrInvalidArgs
	}
	if d.Serper == nil {
		return "", fmt.Errorf("Serper service is not configured")
	}

	limit := in.Limit
	if limit <= 0 {
		limit = 10
	}

	res, err := d.Serper.Search(ctx, inv.OrgID, in.Query, limit)
	if err != nil {
		return "", fmt.Errorf("serper search failed: %w", err)
	}

	return jsonResult(res)
}

func (d Deps) fetchURLContent(ctx context.Context, _ Invocation, args json.RawMessage) (string, error) {
	in, err := decodeArgs[struct {
		URL             string `json:"url"`
		IncludeSubpages *bool  `json:"include_subpages"`
	}](args)
	if err != nil {
		return "", err
	}

	raw := strings.TrimSpace(in.URL)
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		raw = "https://" + raw
	}

	// 1. Strict SSRF Protection (blocks localhost, 127.0.0.1, 10.x, 192.168.x, 172.16.x, metadata IPs)
	if err := webhook.ValidateOutboundURL(raw); err != nil {
		return "", fmt.Errorf("SSRF guard blocked URL: %w", err)
	}

	cacheKey := "aitools:fetch_bdr:" + hashBDRURL(raw)
	if d.Cache != nil {
		var cached string
		if cerr := d.Cache.GetJSON(ctx, cacheKey, &cached); cerr == nil && cached != "" {
			return cached, nil
		}
	}

	// 2. Strict 7-second timeout and safe HTTP client (dial-time reblocking)
	client := safehttp.Client(7 * time.Second)

	mainText, subpageLinks, err := crawlPage(ctx, client, raw)
	if err != nil {
		return "", fmt.Errorf("failed to fetch website %s: %w", raw, err)
	}

	resultMap := map[string]any{
		"url":       raw,
		"main_page": truncateRunes(mainText, 8000),
	}

	includeSubs := true
	if in.IncludeSubpages != nil {
		includeSubs = *in.IncludeSubpages
	}

	if includeSubs && len(subpageLinks) > 0 {
		subpages := make(map[string]string)
		for _, subURL := range subpageLinks {
			if len(subpages) >= 2 {
				break
			}
			if err := webhook.ValidateOutboundURL(subURL); err != nil {
				continue
			}
			subText, _, err := crawlPage(ctx, client, subURL)
			if err == nil && len(subText) > 100 {
				subpages[subURL] = truncateRunes(subText, 3000)
			}
		}
		if len(subpages) > 0 {
			resultMap["subpages"] = subpages
		}
	}

	resStr, err := jsonResult(resultMap)
	if err != nil {
		return "", err
	}

	if d.Cache != nil {
		_ = d.Cache.SetJSON(ctx, cacheKey, resStr, 2*time.Hour)
	}

	return resStr, nil
}

func crawlPage(ctx context.Context, client *http.Client, pageURL string) (string, []string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
	if err != nil {
		return "", nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,text/plain;q=0.9,*/*;q=0.5")

	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	// Strict 2MB limit before sanitization
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", nil, err
	}

	rawHTML := string(body)
	cleanText := htmlToText(rawHTML)

	// Discover about / contact / services subpages on same host
	parsed, err := url.Parse(pageURL)
	var subLinks []string
	if err == nil {
		hrefRe := regexp.MustCompile(`(?i)href=["']([^"']+)["']`)
		matches := hrefRe.FindAllStringSubmatch(rawHTML, -1)
		seen := make(map[string]bool)
		for _, m := range matches {
			if len(m) < 2 {
				continue
			}
			h := strings.TrimSpace(m[1])
			hLower := strings.ToLower(h)
			if strings.Contains(hLower, "about") || strings.Contains(hLower, "contact") || strings.Contains(hLower, "services") {
				resolved, err := parsed.Parse(h)
				if err == nil && resolved.Host == parsed.Host {
					full := resolved.String()
					if !seen[full] && full != pageURL {
						seen[full] = true
						subLinks = append(subLinks, full)
					}
				}
			}
		}
	}

	return cleanText, subLinks, nil
}

func (d Deps) updateLeadFields(ctx context.Context, inv Invocation, args json.RawMessage) (string, error) {
	var in struct {
		ContactID       string `json:"contact_id"`
		Email           string `json:"email"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		CompanyName     string `json:"company_name"`
		JobTitle        string `json:"job_title"`
		Phone           string `json:"phone"`
		City            string `json:"city"`
		Address         string `json:"address"`
		Website         string `json:"website"`
		AIResearchNotes string `json:"ai_research_notes"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return "", ErrInvalidArgs
	}

	if d.Contacts == nil {
		return "", fmt.Errorf("contact service is not configured")
	}

	var contactID uuid.UUID
	var err error

	if strings.TrimSpace(in.ContactID) != "" {
		contactID, err = parseUUIDArg(in.ContactID)
		if err != nil {
			return "", err
		}
	} else if strings.TrimSpace(in.Email) != "" {
		res, xerr := d.Contacts.Search(ctx, inv.OrgID.String(), "", "", "1", models.SearchContacts{Query: strings.TrimSpace(in.Email)})
		if xerr != nil || len(res.Data) == 0 {
			return "", fmt.Errorf("contact with email %s not found", in.Email)
		}
		contactID = res.Data[0].ID
	} else {
		return "", fmt.Errorf("either contact_id or email is required")
	}

	// 1. Fetch current contact to preserve existing fields
	detail, xerr := d.Contacts.GetDetail(ctx, inv.UserID, &inv.OrgID, contactID)
	if xerr != nil {
		return "", fromErrx(xerr)
	}

	// 2. Smart Name Normalization (strips בע"מ, LTD, extracts clean firstName for {{firstName}})
	first := in.FirstName
	if first == "" {
		first = detail.Contact.FirstName
	}
	last := in.LastName
	if last == "" {
		last = detail.Contact.LastName
	}
	company := in.CompanyName
	if company == "" {
		company = detail.Contact.Company
	}
	title := in.JobTitle

	normalized := leadnormalize.NormalizeContactName(first, last, company, title)

	// Merge custom fields
	customFields := make(map[string]string)
	if detail.Contact.CustomFields != nil {
		for k, v := range detail.Contact.CustomFields {
			customFields[k] = v
		}
	}

	if in.City != "" {
		customFields["city"] = in.City
	}
	if in.Address != "" {
		customFields["address"] = in.Address
	}
	if in.Website != "" {
		customFields["website"] = in.Website
	}
	if normalized.JobTitle != "" {
		customFields["job_title"] = normalized.JobTitle
	}
	if in.AIResearchNotes != "" {
		customFields["ai_research_notes"] = in.AIResearchNotes
	}

	upd := &models.UpdateContact{
		FirstName:    &normalized.FirstName,
		LastName:     &normalized.LastName,
		Company:      &normalized.Company,
		CustomFields: &customFields,
	}
	if in.Phone != "" {
		upd.Phone = &in.Phone
	}

	if _, xerr := d.Contacts.Update(ctx, inv.UserID.String(), contactID.String(), inv.OrgID, upd); xerr != nil {
		return "", fromErrx(xerr)
	}

	return jsonResult(map[string]any{
		"success":        true,
		"contact_id":     contactID.String(),
		"first_name":     normalized.FirstName,
		"last_name":      normalized.LastName,
		"company":        normalized.Company,
		"custom_fields":  customFields,
		"normalized_tag": fmt.Sprintf("{{firstName}} will resolve to: %s", normalized.FirstName),
	})
}

func (d Deps) frappeCRMSync(ctx context.Context, inv Invocation, args json.RawMessage) (string, error) {
	var in struct {
		ContactID       string `json:"contact_id"`
		TaskTitle       string `json:"task_title"`
		TaskDescription string `json:"task_description"`
		TaskDueDate     string `json:"task_due_date"`
		EventTitle      string `json:"event_title"`
		EventStart      string `json:"event_start"`
		EventEnd        string `json:"event_end"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return "", ErrInvalidArgs
	}

	contactID, err := parseUUIDArg(in.ContactID)
	if err != nil {
		return "", err
	}

	if d.Contacts == nil {
		return "", fmt.Errorf("contact service is not configured")
	}
	if d.Automations == nil {
		return "", fmt.Errorf("automation/integration service is not configured")
	}

	detail, xerr := d.Contacts.GetDetail(ctx, inv.UserID, &inv.OrgID, contactID)
	if xerr != nil {
		return "", fromErrx(xerr)
	}
	contact := detail.Contact

	// Props for Frappe CRM
	props := map[string]any{
		"first_name": contact.FirstName,
		"last_name":  contact.LastName,
		"company":    contact.Company,
		"phone":      contact.Phone,
	}
	if contact.CustomFields != nil {
		if val, ok := contact.CustomFields["job_title"]; ok {
			props["job_title"] = val
		}
		if val, ok := contact.CustomFields["website"]; ok {
			props["website"] = val
		}
		if val, ok := contact.CustomFields["ai_research_notes"]; ok {
			props["ai_research_notes"] = val
		}
	}

	task := map[string]any{
		"title":       in.TaskTitle,
		"description": in.TaskDescription,
		"due_date":    in.TaskDueDate,
	}

	event := map[string]any{
		"subject":   in.EventTitle,
		"starts_on": in.EventStart,
		"ends_on":   in.EventEnd,
	}

	// 1. Sync with Deduplication lookup
	leadID, err := d.Automations.SyncFrappeLead(ctx, inv.OrgID, contact.Email, props, task, event)
	if err != nil {
		return "", fmt.Errorf("Frappe CRM sync failed: %w", err)
	}

	// 2. Record frappe_lead_id in contact custom_fields
	cf := make(map[string]string)
	if contact.CustomFields != nil {
		for k, v := range contact.CustomFields {
			cf[k] = v
		}
	}
	cf["frappe_lead_id"] = leadID
	cf["frappe_synced_at"] = time.Now().UTC().Format(time.RFC3339)

	_, _ = d.Contacts.Update(ctx, inv.UserID.String(), contactID.String(), inv.OrgID, &models.UpdateContact{
		CustomFields: &cf,
	})

	return jsonResult(map[string]any{
		"success":        true,
		"frappe_lead_id": leadID,
		"email":          contact.Email,
		"action":         "Lead synced and linked to Frappe CRM",
	})
}

func (d Deps) markDoNotContact(ctx context.Context, inv Invocation, args json.RawMessage) (string, error) {
	var in struct {
		ContactID string `json:"contact_id"`
		Reason    string `json:"reason"`
	}
	if err := json.Unmarshal(args, &in); err != nil {
		return "", ErrInvalidArgs
	}

	contactID, err := parseUUIDArg(in.ContactID)
	if err != nil {
		return "", err
	}

	if d.Contacts == nil {
		return "", fmt.Errorf("contact service is not configured")
	}

	detail, xerr := d.Contacts.GetDetail(ctx, inv.UserID, &inv.OrgID, contactID)
	if xerr != nil {
		return "", fromErrx(xerr)
	}
	contact := detail.Contact

	// 1. Update contact subscription state
	unsub := false
	_, xerr = d.Contacts.Update(ctx, inv.UserID.String(), contactID.String(), inv.OrgID, &models.UpdateContact{
		Subscribed: &unsub,
	})
	if xerr != nil {
		return "", fromErrx(xerr)
	}

	reason := in.Reason
	if strings.TrimSpace(reason) == "" {
		reason = "Marked DNC by autonomous BDR agent"
	}

	// 2. Add to workspace suppressions list
	if d.Suppressions != nil && contact.Email != "" {
		_, _ = d.Suppressions.AddSuppressions(ctx, inv.OrgID, inv.UserID, &models.AddSuppressionsRequest{
			Reason:  reason,
			Entries: []models.SuppressionEntry{{Value: contact.Email}},
		})
	}

	// 3. Mark DNC in Frappe CRM if connected
	if d.Automations != nil && contact.Email != "" {
		_ = d.Automations.MarkFrappeLeadDNC(ctx, inv.OrgID, contact.Email)
	}

	return jsonResult(map[string]any{
		"success":    true,
		"contact_id": contactID.String(),
		"email":      contact.Email,
		"status":     "Suppressed / Do Not Contact",
		"reason":     reason,
	})
}

func hashBDRURL(u string) string {
	sum := sha256.Sum256([]byte(u))
	return hex.EncodeToString(sum[:])
}
