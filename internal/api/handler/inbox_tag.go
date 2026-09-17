package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/config"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/repository"
)

// The phase-1 review surface. Automatic tagging writes labels and a score and
// nothing else, and the point of the phase is that a person watches it decide
// for a week before it is allowed to act. That is only possible if what it
// decided, and how sure it was, is on a screen.
//
// GET /inbox-tagging/review?limit=&offset=&needs_review=

type inboxTagRow struct {
	ID               string          `json:"id"`
	MessageID        string          `json:"message_id"`
	ThreadID         string          `json:"thread_id"`
	Kind             string          `json:"kind"`
	KindConfidence   float64         `json:"kind_confidence"`
	KindSource       string          `json:"kind_source"`
	Intent           string          `json:"intent"`
	IntentConfidence float64         `json:"intent_confidence"`
	Relevance        int             `json:"relevance"`
	Priority         string          `json:"priority"`
	NeedsReview      bool            `json:"needs_review"`
	Labels           []string        `json:"labels"`
	Answers          json.RawMessage `json:"answers"`
	Model            string          `json:"model"`
	InputTokens      int             `json:"input_tokens"`
	CreatedAt        string          `json:"created_at"`
}

type inboxTagReviewResponse struct {
	// Enabled says whether the feature is switched on for this instance, so the
	// page can explain an empty list rather than implying nothing was found.
	Enabled bool          `json:"enabled"`
	Data    []inboxTagRow `json:"data"`
	Total   int           `json:"total"`
}

func (h *Handler) GetInboxTaggingReview(c *gin.Context) {
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.Handle(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	enabled := config.InboxTaggingEnabled()
	if h.InboxTagRepo == nil {
		c.JSON(http.StatusOK, inboxTagReviewResponse{Enabled: enabled, Data: []inboxTagRow{}})
		return
	}

	limit := 50
	if v, err := strconv.Atoi(c.DefaultQuery("limit", "50")); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	offset := 0
	if v, err := strconv.Atoi(c.DefaultQuery("offset", "0")); err == nil && v >= 0 {
		offset = v
	}
	needsReviewOnly, _ := strconv.ParseBool(c.DefaultQuery("needs_review", "false"))

	rows, total, err := h.InboxTagRepo.ListForReview(c.Request.Context(), *orgID, limit, offset, needsReviewOnly)
	if err != nil {
		errx.Handle(c, errx.InternalError())
		return
	}

	out := make([]inboxTagRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, toTagRow(r))
	}
	c.JSON(http.StatusOK, inboxTagReviewResponse{Enabled: enabled, Data: out, Total: total})
}

func toTagRow(r repository.InboxTagResult) inboxTagRow {
	labels := r.Labels
	if labels == nil {
		labels = []string{}
	}
	answers := r.Answers
	if len(answers) == 0 {
		answers = json.RawMessage(`{}`)
	}
	return inboxTagRow{
		ID:               r.ID.String(),
		MessageID:        r.MessageID,
		ThreadID:         r.ThreadID,
		Kind:             r.Kind,
		KindConfidence:   r.KindConfidence,
		KindSource:       r.KindSource,
		Intent:           r.Intent,
		IntentConfidence: r.IntentConfidence,
		Relevance:        r.Relevance,
		Priority:         r.Priority,
		NeedsReview:      r.NeedsReview,
		Labels:           labels,
		Answers:          answers,
		Model:            r.Model,
		InputTokens:      r.InputTokens,
		CreatedAt:        r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
