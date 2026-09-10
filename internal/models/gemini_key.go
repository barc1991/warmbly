package models

import (
	"time"

	"github.com/google/uuid"
)

type GeminiKeyStatus string

const (
	GeminiKeyStatusActive   GeminiKeyStatus = "active"
	GeminiKeyStatusPaused   GeminiKeyStatus = "paused"
	GeminiKeyStatusDisabled GeminiKeyStatus = "disabled"
	GeminiKeyStatusCooldown GeminiKeyStatus = "cooldown"
)

// OrgGeminiKey represents an individual Google Gemini API key belonging to an organization.
type OrgGeminiKey struct {
	ID            uuid.UUID       `json:"id"`
	OrgID         uuid.UUID       `json:"org_id"`
	Name          string          `json:"name"`
	MaskedKey     string          `json:"masked_key"`
	EncryptedKey  string          `json:"-"`
	Status        GeminiKeyStatus `json:"status"`
	FailCount     int             `json:"fail_count"`
	RequestCount  int             `json:"request_count"`
	LastUsed      *time.Time      `json:"last_used,omitempty"`
	LastError     string          `json:"last_error,omitempty"`
	CooldownUntil *time.Time      `json:"cooldown_until,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// GeminiRotationStats provides aggregated runtime health and rotation stats for the organization.
type GeminiRotationStats struct {
	TotalKeys      int      `json:"total_keys"`
	ActiveKeys     int      `json:"active_keys"`
	CooldownKeys   int      `json:"cooldown_keys"`
	DisabledKeys   int      `json:"disabled_keys"`
	TotalRequests  int64    `json:"total_requests"`
	TotalRotations int64    `json:"total_rotations"`
	CurrentModel   string   `json:"current_model"`
	FallbackChain  []string `json:"fallback_chain"`
}

// GeminiOrgConfig holds the primary model choice and fallback configuration.
type GeminiOrgConfig struct {
	PrimaryModel    string   `json:"primary_model"`
	FallbackEnabled bool     `json:"fallback_enabled"`
	FallbackChain   []string `json:"fallback_chain"`
}
