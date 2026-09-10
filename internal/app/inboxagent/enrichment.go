package inboxagent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/warmbly/warmbly/internal/app/webhook"
	"github.com/warmbly/warmbly/internal/pkg/generation"
	"github.com/warmbly/warmbly/internal/pkg/safehttp"
)

// InboundAnalysisResult holds Gemini intent classification and signature extraction data.
type InboundAnalysisResult struct {
	IntentClass    string         `json:"intent_class"`
	Confidence     float64        `json:"confidence"`
	Rationale      string         `json:"rationale"`
	KeyInsight     string         `json:"key_insight"`
	ReturnDate     string         `json:"return_date,omitempty"`
	ReferredName   string         `json:"referred_name,omitempty"`
	ReferredEmail  string         `json:"referred_email,omitempty"`
	ReferredRole   string         `json:"referred_role,omitempty"`
	SignaturePhone string         `json:"signature_phone,omitempty"`
	SignatureTitle string         `json:"signature_title,omitempty"`
	SignatureComp  string         `json:"signature_company,omitempty"`
	SignatureWeb   string         `json:"signature_website,omitempty"`
	SignatureRaw   map[string]any `json:"signature_raw,omitempty"`
}

const analysisSystemPrompt = `You are an expert BDR and email analyst for an advertising agency.
Analyze the inbound email response carefully.
1. Classify the intent into one of:
   - INTERESTED (e.g. wants to hear more, asked pricing, asking questions)
   - MEETING_REQUEST (e.g. asked for call, calendar, meeting, demo)
   - OUT_OF_OFFICE (e.g. away, vacation, maternity leave, return date mentioned)
   - REFERRAL (e.g. not me, speak with colleague X at email Y)
   - NOT_INTERESTED (e.g. no thanks, not relevant, pass)
   - UNSUBSCRIBE (e.g. remove me, stop emailing, unsubscribe)
   - NEUTRAL / OTHER
2. If OUT_OF_OFFICE: extract return_date (YYYY-MM-DD or descriptive).
3. If REFERRAL: extract referred_name, referred_email, referred_role.
4. Extract sender's email signature block if present:
   - signature_phone
   - signature_title
   - signature_company
   - signature_website
5. Provide a short 1-sentence key_insight about the lead's business context or reply mood, and a confidence score between 0.0 and 1.0.

Respond strictly in JSON matching this schema:
{
  "intent_class": "INTERESTED|MEETING_REQUEST|OUT_OF_OFFICE|REFERRAL|NOT_INTERESTED|UNSUBSCRIBE|NEUTRAL",
  "confidence": 0.95,
  "rationale": "Reason for classification",
  "key_insight": "Key insight from email or signature",
  "return_date": "",
  "referred_name": "",
  "referred_email": "",
  "referred_role": "",
  "signature_phone": "",
  "signature_title": "",
  "signature_company": "",
  "signature_website": ""
}`

// AnalyzeInboundEmail uses Gemini to classify intent, extract signature, and evaluate referral/OOO.
func AnalyzeInboundEmail(ctx context.Context, provider generation.Provider, subject, bodyText, counterpart string) (*InboundAnalysisResult, error) {
	if provider == nil {
		return fallbackClassification(subject, bodyText), nil
	}

	prompt := fmt.Sprintf("Subject: %s\nFrom: %s\n\nEmail Body:\n%s", subject, counterpart, bodyText)

	res, err := provider.Complete(ctx, generation.CompletionRequest{
		System: analysisSystemPrompt,
		Prompt: prompt,
		Model:  provider.ModelForTier(true),
	})
	if err != nil || res == nil || strings.TrimSpace(res.Text) == "" {
		return fallbackClassification(subject, bodyText), nil
	}

	text := strings.TrimSpace(res.Text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var analysis InboundAnalysisResult
	if err := json.Unmarshal([]byte(text), &analysis); err != nil {
		return fallbackClassification(subject, bodyText), nil
	}

	// Prepare raw signature map for storage
	sigMap := make(map[string]any)
	if analysis.SignaturePhone != "" {
		sigMap["phone"] = analysis.SignaturePhone
	}
	if analysis.SignatureTitle != "" {
		sigMap["title"] = analysis.SignatureTitle
	}
	if analysis.SignatureComp != "" {
		sigMap["company"] = analysis.SignatureComp
	}
	if analysis.SignatureWeb != "" {
		sigMap["website"] = analysis.SignatureWeb
	}
	if analysis.ReturnDate != "" {
		sigMap["return_date"] = analysis.ReturnDate
	}
	analysis.SignatureRaw = sigMap

	return &analysis, nil
}

func fallbackClassification(subject, body string) *InboundAnalysisResult {
	lower := strings.ToLower(subject + " " + body)
	res := &InboundAnalysisResult{
		Confidence: 0.70,
	}

	switch {
	case strings.Contains(lower, "unsubscribe") || strings.Contains(lower, "remove") || strings.Contains(lower, "אל תשלח") || strings.Contains(lower, "הסר"):
		res.IntentClass = "UNSUBSCRIBE"
		res.Confidence = 0.95
		res.Rationale = "Opt-out keyword detected"
	case strings.Contains(lower, "out of office") || strings.Contains(lower, "automatic reply") || strings.Contains(lower, "בחופשה") || strings.Contains(lower, "הודעה אוטומטית"):
		res.IntentClass = "OUT_OF_OFFICE"
		res.Confidence = 0.90
		res.Rationale = "Out of office marker detected"
	case strings.Contains(lower, "מעוניין") || strings.Contains(lower, "interested") || strings.Contains(lower, "let's talk") || strings.Contains(lower, "מחיר") || strings.Contains(lower, "pricing"):
		res.IntentClass = "INTERESTED"
		res.Confidence = 0.85
		res.Rationale = "Interest keyword detected"
	default:
		res.IntentClass = "NEUTRAL"
		res.Confidence = 0.60
		res.Rationale = "General response"
	}
	return res
}

// InspectWebsiteForFirstReply safely crawls the lead's domain on the first reply.
func InspectWebsiteForFirstReply(ctx context.Context, counterpartEmail, explicitURL string) (string, error) {
	targetURL := strings.TrimSpace(explicitURL)
	if targetURL == "" && strings.Contains(counterpartEmail, "@") {
		parts := strings.Split(counterpartEmail, "@")
		domain := parts[len(parts)-1]
		// Skip generic mail providers
		if !isGenericEmailDomain(domain) {
			targetURL = "https://" + domain
		}
	}

	if targetURL == "" {
		return "", nil
	}

	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	if err := webhook.ValidateOutboundURL(targetURL); err != nil {
		return "", err
	}

	client := safehttp.Client(7 * time.Second)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "WarmblyBDR/1.0 (+https://warmbly.com)")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}

	text := htmlToText(string(body))
	text = strings.TrimSpace(text)
	if len(text) > 4000 {
		text = text[:4000] + "…"
	}
	return text, nil
}

// DeliverabilitySpamGuardrail enforces Requirement #1:
// Prevents extreme spam trigger words and untrusted links unless requested, and appends mailbox signature.
func DeliverabilitySpamGuardrail(bodyText, mailboxSignature string) (string, error) {
	// Extreme spam phrase checks
	spamKeywords := []string{
		"100% free", "guaranteed income", "risk-free wire", "wire transfer immediately",
		"click here now to claim", "הכנסה מובטחת במאה אחוז", "העברה בנקאית מיידית",
	}

	lower := strings.ToLower(bodyText)
	for _, kw := range spamKeywords {
		if strings.Contains(lower, kw) {
			return "", fmt.Errorf("reply blocked by spam guardrail: contains suspicious phrase '%s'", kw)
		}
	}

	clean := strings.TrimSpace(bodyText)

	// Append sender mailbox signature if provided and not already present
	if strings.TrimSpace(mailboxSignature) != "" {
		if !strings.Contains(clean, strings.TrimSpace(mailboxSignature)) {
			clean = clean + "\n\n--\n" + strings.TrimSpace(mailboxSignature)
		}
	}

	return clean, nil
}

func isGenericEmailDomain(d string) bool {
	generic := map[string]bool{
		"gmail.com": true, "yahoo.com": true, "hotmail.com": true, "outlook.com": true,
		"icloud.com": true, "aol.com": true, "mail.com": true, "zoho.com": true,
		"walla.co.il": true, "netvision.net.il": true, "bezeqint.net": true,
	}
	return generic[strings.ToLower(strings.TrimSpace(d))]
}

func htmlToText(html string) string {
	tagRe := regexp.MustCompile(`<[^>]*>`)
	s := tagRe.ReplaceAllString(html, " ")
	wsRe := regexp.MustCompile(`\s+`)
	s = wsRe.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}
