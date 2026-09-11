package integration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
)

var (
	ErrFrappeNotConfigured = errors.New("Frappe CRM integration is not connected in this organization")
)

type frappeCredentials struct {
	serverURL string
	apiKey    string
	apiSecret string
	connID    uuid.UUID
}

func (s *service) findFrappeConnection(ctx context.Context, orgID uuid.UUID) (*frappeCredentials, error) {
	conns, err := s.repo.ListConnections(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list connections: %w", err)
	}

	for _, c := range conns {
		if c.Provider == models.IntegrationFrappeCRM {
			sec, err := s.repo.GetConnectionSecrets(ctx, c.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to get connection secrets: %w", err)
			}
			cfg, err := s.openConfig(ctx, sec)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt config: %w", err)
			}

			apiKey := stringFromMap(cfg, "api_key")
			apiSecret := stringFromMap(cfg, "api_secret")
			serverURL := stringFromMap(cfg, "server_url")
			if serverURL == "" {
				serverURL = configString(c.DisplayFields, "server_url")
			}

			if apiKey == "" || apiSecret == "" || serverURL == "" {
				return nil, errors.New("incomplete Frappe CRM credentials configured")
			}

			return &frappeCredentials{
				serverURL: strings.TrimRight(strings.TrimSpace(serverURL), "/"),
				apiKey:    apiKey,
				apiSecret: apiSecret,
				connID:    c.ID,
			}, nil
		}
	}

	return nil, ErrFrappeNotConfigured
}

// SyncFrappeLead performs deduplication lookup by email, updates or creates the lead,
// optionally adds tasks/calendar events, and returns the Frappe Lead ID.
func (s *service) SyncFrappeLead(ctx context.Context, orgID uuid.UUID, email string, props map[string]any, task map[string]any, event map[string]any) (string, error) {
	creds, err := s.findFrappeConnection(ctx, orgID)
	if err != nil {
		return "", err
	}

	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("email is required for Frappe CRM sync")
	}

	// 1. Deduplication lookup by email
	docType := "CRM Lead"
	filters := fmt.Sprintf(`[["%s","email","=","%s"]]`, docType, email)
	searchURL := fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
		creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(`["name","email"]`))

	var search struct {
		Data []struct {
			Name string `json:"name"`
		} `json:"data"`
	}

	err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	if err != nil && strings.Contains(err.Error(), "HTTP 404") {
		docType = "Lead"
		filters = fmt.Sprintf(`[["%s","email_id","=","%s"]]`, docType, email)
		searchURL = fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
			creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(`["name","email_id"]`))
		err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	}
	if err != nil {
		return "", fmt.Errorf("Frappe lookup failed: %w", err)
	}

	// Build payload
	firstName := strProp(props, "first_name")
	lastName := strProp(props, "last_name")
	if firstName == "" {
		firstName = email
	}

	payload := map[string]any{
		"first_name": firstName,
	}
	if lastName != "" {
		payload["last_name"] = lastName
	}

	if docType == "CRM Lead" {
		payload["email"] = email
		if org := strProp(props, "company"); org != "" {
			payload["organization"] = org
		}
		if phone := strProp(props, "phone"); phone != "" {
			payload["mobile_no"] = phone
			payload["phone"] = phone
		}
		if title := strProp(props, "job_title"); title != "" {
			payload["job_title"] = title
		}
		if website := strProp(props, "website"); website != "" {
			payload["website"] = website
		}
		if notes := strProp(props, "ai_research_notes"); notes != "" {
			payload["notes"] = notes
		}
	} else {
		payload["email_id"] = email
		if comp := strProp(props, "company"); comp != "" {
			payload["company_name"] = comp
		}
		if phone := strProp(props, "phone"); phone != "" {
			payload["mobile_no"] = phone
			payload["phone"] = phone
		}
		if website := strProp(props, "website"); website != "" {
			payload["website"] = website
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	leadName := ""

	if len(search.Data) > 0 {
		// Existing lead: UPDATE (Deduplication)
		leadName = search.Data[0].Name
		putURL := fmt.Sprintf("%s/api/resource/%s/%s", creds.serverURL, url.PathEscape(docType), url.PathEscape(leadName))
		if err := frappeJSON(ctx, http.MethodPut, putURL, creds.apiKey, creds.apiSecret, body, nil); err != nil {
			return "", fmt.Errorf("Frappe update lead failed: %w", err)
		}
	} else {
		// New lead: CREATE
		postURL := fmt.Sprintf("%s/api/resource/%s", creds.serverURL, url.PathEscape(docType))
		var created struct {
			Data struct {
				Name string `json:"name"`
			} `json:"data"`
		}
		if err := frappeJSON(ctx, http.MethodPost, postURL, creds.apiKey, creds.apiSecret, body, &created); err != nil {
			return "", fmt.Errorf("Frappe create lead failed: %w", err)
		}
		leadName = created.Data.Name
	}

	// 2. Optional Task creation
	if taskTitle := strProp(task, "title"); taskTitle != "" {
		taskPayload := map[string]any{
			"title":             taskTitle,
			"description":       strProp(task, "description"),
			"reference_doctype": docType,
			"reference_name":    leadName,
			"priority":          "Medium",
		}
		if due := strProp(task, "due_date"); due != "" {
			taskPayload["due_date"] = due
		}
		taskBody, _ := json.Marshal(taskPayload)
		taskURL := fmt.Sprintf("%s/api/resource/CRM Task", creds.serverURL)
		err := frappeJSON(ctx, http.MethodPost, taskURL, creds.apiKey, creds.apiSecret, taskBody, nil)
		if err != nil && strings.Contains(err.Error(), "HTTP 404") {
			// Fallback to generic Task
			taskURL = fmt.Sprintf("%s/api/resource/Task", creds.serverURL)
			_ = frappeJSON(ctx, http.MethodPost, taskURL, creds.apiKey, creds.apiSecret, taskBody, nil)
		}
	}

	// 3. Optional Calendar Event creation
	if eventSubject := strProp(event, "subject"); eventSubject != "" {
		eventPayload := map[string]any{
			"subject":     eventSubject,
			"description": strProp(event, "description"),
			"event_type":  "Private",
		}
		if starts := strProp(event, "starts_on"); starts != "" {
			eventPayload["starts_on"] = starts
		}
		if ends := strProp(event, "ends_on"); ends != "" {
			eventPayload["ends_on"] = ends
		}
		eventBody, _ := json.Marshal(eventPayload)
		eventURL := fmt.Sprintf("%s/api/resource/Event", creds.serverURL)
		_ = frappeJSON(ctx, http.MethodPost, eventURL, creds.apiKey, creds.apiSecret, eventBody, nil)
	}

	return leadName, nil
}

// MarkFrappeLeadDNC marks a lead as Do Not Contact / Unsubscribed in Frappe CRM.
func (s *service) MarkFrappeLeadDNC(ctx context.Context, orgID uuid.UUID, email string) error {
	creds, err := s.findFrappeConnection(ctx, orgID)
	if err != nil {
		return err
	}

	email = strings.TrimSpace(email)
	if email == "" {
		return nil
	}

	docType := "CRM Lead"
	filters := fmt.Sprintf(`[["%s","email","=","%s"]]`, docType, email)
	searchURL := fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
		creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(`["name"]`))

	var search struct {
		Data []struct {
			Name string `json:"name"`
		} `json:"data"`
	}

	err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	if err != nil && strings.Contains(err.Error(), "HTTP 404") {
		docType = "Lead"
		filters = fmt.Sprintf(`[["%s","email_id","=","%s"]]`, docType, email)
		searchURL = fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
			creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(`["name"]`))
		err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	}
	if err != nil || len(search.Data) == 0 {
		return nil // Lead not found in Frappe, nothing to update
	}

	leadName := search.Data[0].Name
	putURL := fmt.Sprintf("%s/api/resource/%s/%s", creds.serverURL, url.PathEscape(docType), url.PathEscape(leadName))

	updatePayload := map[string]any{
		"status": "Do Not Contact",
	}
	body, _ := json.Marshal(updatePayload)
	return frappeJSON(ctx, http.MethodPut, putURL, creds.apiKey, creds.apiSecret, body, nil)
}

// GetFrappeLead fetches the lead card and related open tasks from Frappe CRM by email.
func (s *service) GetFrappeLead(ctx context.Context, orgID uuid.UUID, email string) (map[string]any, error) {
	creds, err := s.findFrappeConnection(ctx, orgID)
	if err != nil {
		return nil, err
	}

	email = strings.TrimSpace(email)
	if email == "" {
		return nil, errors.New("email is required for Frappe CRM lookup")
	}

	docType := "CRM Lead"
	fields := `["name","email","first_name","last_name","organization","mobile_no","phone","job_title","website","status","lead_owner","notes"]`
	filters := fmt.Sprintf(`[["%s","email","=","%s"]]`, docType, email)
	searchURL := fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
		creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(fields))

	var search struct {
		Data []map[string]any `json:"data"`
	}

	err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	if err != nil && strings.Contains(err.Error(), "HTTP 404") {
		docType = "Lead"
		fields = `["name","email_id","first_name","last_name","company_name","mobile_no","phone","website","status","lead_owner","notes"]`
		filters = fmt.Sprintf(`[["%s","email_id","=","%s"]]`, docType, email)
		searchURL = fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
			creds.serverURL, url.PathEscape(docType), url.QueryEscape(filters), url.QueryEscape(fields))
		err = frappeJSON(ctx, http.MethodGet, searchURL, creds.apiKey, creds.apiSecret, nil, &search)
	}
	if err != nil {
		return nil, fmt.Errorf("Frappe lookup failed: %w", err)
	}

	if len(search.Data) == 0 {
		return map[string]any{
			"found":   false,
			"email":   email,
			"message": "No matching lead found in Frappe CRM",
		}, nil
	}

	leadRecord := search.Data[0]
	leadName, _ := leadRecord["name"].(string)

	// Fetch open tasks for this lead if any
	var tasks []map[string]any
	if leadName != "" {
		taskDocType := "CRM Task"
		taskFilters := fmt.Sprintf(`[["%s","reference_doctype","=","%s"],["%s","reference_name","=","%s"]]`,
			taskDocType, docType, taskDocType, leadName)
		taskURL := fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
			creds.serverURL, url.PathEscape(taskDocType), url.QueryEscape(taskFilters), url.QueryEscape(`["name","title","status","priority","due_date"]`))
		var taskSearch struct {
			Data []map[string]any `json:"data"`
		}
		if terr := frappeJSON(ctx, http.MethodGet, taskURL, creds.apiKey, creds.apiSecret, nil, &taskSearch); terr == nil {
			tasks = taskSearch.Data
		} else if strings.Contains(terr.Error(), "HTTP 404") {
			// Fallback to standard Task
			taskDocType = "Task"
			taskFilters = fmt.Sprintf(`[["%s","reference_doctype","=","%s"],["%s","reference_name","=","%s"]]`,
				taskDocType, docType, taskDocType, leadName)
			taskURL = fmt.Sprintf("%s/api/resource/%s?filters=%s&fields=%s",
				creds.serverURL, url.PathEscape(taskDocType), url.QueryEscape(taskFilters), url.QueryEscape(`["name","title","status","priority","exp_end_date"]`))
			var genericTaskSearch struct {
				Data []map[string]any `json:"data"`
			}
			if gerr := frappeJSON(ctx, http.MethodGet, taskURL, creds.apiKey, creds.apiSecret, nil, &genericTaskSearch); gerr == nil {
				tasks = genericTaskSearch.Data
			}
		}
	}

	return map[string]any{
		"found":    true,
		"email":    email,
		"doctype":  docType,
		"lead":     leadRecord,
		"tasks":    tasks,
		"crm_link": fmt.Sprintf("%s/app/%s/%s", creds.serverURL, strings.ToLower(strings.ReplaceAll(docType, " ", "-")), leadName),
	}, nil
}

// SyncMeetingToFrappeEvent pushes a scheduled meeting to Frappe CRM's calendar (Event doctype).
func (s *service) SyncMeetingToFrappeEvent(ctx context.Context, orgID uuid.UUID, booking *models.MeetingBooking) error {
	if booking == nil {
		return nil
	}
	creds, err := s.findFrappeConnection(ctx, orgID)
	if err != nil {
		return err
	}

	subject := strings.TrimSpace(booking.EventName)
	if subject == "" {
		subject = "שיחה עם " + strings.TrimSpace(booking.InviteeName)
	}
	if booking.InviteeName != "" && !strings.Contains(subject, booking.InviteeName) {
		subject = fmt.Sprintf("%s - %s", subject, booking.InviteeName)
	}

	if booking.ScheduledFor == nil {
		return nil
	}
	startsOn := booking.ScheduledFor.UTC().Format("2006-01-02 15:04:05")

	endsOn := ""
	if booking.EndTime != nil {
		endsOn = booking.EndTime.UTC().Format("2006-01-02 15:04:05")
	} else {
		endsOn = booking.ScheduledFor.Add(30 * time.Minute).UTC().Format("2006-01-02 15:04:05")
	}

	descParts := make([]string, 0, 4)
	if booking.InviteeName != "" || booking.InviteeEmail != "" {
		descParts = append(descParts, fmt.Sprintf("משתתף: %s <%s>", booking.InviteeName, booking.InviteeEmail))
	}
	if booking.JoinURL != "" {
		descParts = append(descParts, fmt.Sprintf("קישור לשיחה: %s", booking.JoinURL))
	}
	if booking.Location != "" {
		descParts = append(descParts, fmt.Sprintf("מיקום: %s", booking.Location))
	}
	descParts = append(descParts, "נוצר אוטומטית מ-Warmbly")

	eventPayload := map[string]any{
		"subject":     subject,
		"description": strings.Join(descParts, "\n"),
		"event_type":  "Private",
		"starts_on":   startsOn,
		"ends_on":     endsOn,
		"status":      "Open",
	}

	eventBody, _ := json.Marshal(eventPayload)
	eventURL := fmt.Sprintf("%s/api/resource/Event", creds.serverURL)
	return frappeJSON(ctx, http.MethodPost, eventURL, creds.apiKey, creds.apiSecret, eventBody, nil)
}
