package models

import (
	"time"

	"github.com/google/uuid"
)

type SerperKeyStatus string

const (
	SerperKeyStatusActive    SerperKeyStatus = "active"
	SerperKeyStatusPaused    SerperKeyStatus = "paused"
	SerperKeyStatusDisabled  SerperKeyStatus = "disabled"
	SerperKeyStatusCooldown  SerperKeyStatus = "cooldown"
	SerperKeyStatusExhausted SerperKeyStatus = "exhausted"
)

// OrgSerperKey represents an individual Serper Google Search API key for an org.
type OrgSerperKey struct {
	ID               uuid.UUID       `json:"id"`
	OrgID            uuid.UUID       `json:"org_id"`
	Name             string          `json:"name"`
	MaskedKey        string          `json:"masked_key"`
	EncryptedKey     string          `json:"-"`
	Status           SerperKeyStatus `json:"status"`
	FailCount        int             `json:"fail_count"`
	RequestCount     int             `json:"request_count"`
	RemainingCredits int             `json:"remaining_credits"`
	LastUsed         *time.Time      `json:"last_used,omitempty"`
	LastError        string          `json:"last_error,omitempty"`
	CooldownUntil    *time.Time      `json:"cooldown_until,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// SerperRotationStats aggregates keys and quota for the workspace.
type SerperRotationStats struct {
	TotalKeys        int   `json:"total_keys"`
	ActiveKeys       int   `json:"active_keys"`
	CooldownKeys     int   `json:"cooldown_keys"`
	ExhaustedKeys    int   `json:"exhausted_keys"`
	TotalRequests    int64 `json:"total_requests"`
	RemainingCredits int64 `json:"remaining_credits"`
}

// BDRSettings holds the autonomous inbox & lead research controls.
type BDRSettings struct {
	InboxAutoSendEnabled       bool    `json:"inbox_auto_send_enabled"`
	InboxAutoSendMinConfidence float64 `json:"inbox_auto_send_min_confidence"`
	FirstReplyWebsiteCrawl     bool    `json:"first_reply_website_crawl"`
	SignatureExtractionEnabled bool    `json:"signature_extraction_enabled"`
}
