package serper

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
)

var (
	ErrNoActiveSerperKeys = errors.New("no active Serper API keys available (all in cooldown, exhausted, or paused)")
)

// SerperKeyCallback handles persisting key usage and state changes to the database.
type SerperKeyCallback interface {
	OnKeySuccess(ctx context.Context, keyID uuid.UUID, credits int)
	OnKeyRateLimit(ctx context.Context, keyID uuid.UUID, cooldownUntil time.Time, errMsg string)
	OnKeyExhausted(ctx context.Context, keyID uuid.UUID, errMsg string)
}

// ManagedKey wraps an OrgSerperKey with decrypted key string.
type ManagedKey struct {
	Model        *models.OrgSerperKey
	DecryptedKey string
}

// SerperKeyRotator rotates multiple Serper API keys for an organization.
type SerperKeyRotator struct {
	orgID    uuid.UUID
	client   *Client
	callback SerperKeyCallback

	mu   sync.Mutex
	keys []*ManagedKey
	idx  int
}

// NewSerperKeyRotator creates a rotator for the org with decrypted keys.
func NewSerperKeyRotator(orgID uuid.UUID, keys []*ManagedKey, client *Client, cb SerperKeyCallback) *SerperKeyRotator {
	if client == nil {
		client = NewClient()
	}
	return &SerperKeyRotator{
		orgID:    orgID,
		keys:     keys,
		client:   client,
		callback: cb,
	}
}

// KeyCount returns total keys loaded.
func (r *SerperKeyRotator) KeyCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.keys)
}

// PickKey chooses an active key via round-robin, clearing expired cooldowns.
func (r *SerperKeyRotator) PickKey() (*ManagedKey, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.keys) == 0 {
		return nil, ErrNoActiveSerperKeys
	}

	now := time.Now()
	n := len(r.keys)

	for i := 0; i < n; i++ {
		candidate := r.keys[(r.idx+i)%n]
		m := candidate.Model

		// Check if cooldown expired
		if m.Status == models.SerperKeyStatusCooldown && m.CooldownUntil != nil && now.After(*m.CooldownUntil) {
			m.Status = models.SerperKeyStatusActive
			m.CooldownUntil = nil
		}

		// Check if quota already exceeded
		if m.RequestCount >= 2500 {
			m.Status = models.SerperKeyStatusExhausted
		}

		if m.Status == models.SerperKeyStatusActive {
			r.idx = (r.idx + i + 1) % n
			return candidate, nil
		}
	}

	return nil, ErrNoActiveSerperKeys
}

// Search executes a search with smart key rotation and fallback on rate limits or quota depletion.
func (r *SerperKeyRotator) Search(ctx context.Context, query string, num int) (*SearchResponse, error) {
	r.mu.Lock()
	totalKeys := len(r.keys)
	r.mu.Unlock()

	if totalKeys == 0 {
		return nil, ErrNoActiveSerperKeys
	}

	var lastErr error

	for attempt := 0; attempt < totalKeys; attempt++ {
		key, err := r.PickKey()
		if err != nil {
			if lastErr != nil {
				return nil, fmt.Errorf("%w (last error: %v)", ErrNoActiveSerperKeys, lastErr)
			}
			return nil, ErrNoActiveSerperKeys
		}

		res, err := r.client.Search(ctx, key.DecryptedKey, query, num)
		if err == nil {
			// Success: update stats
			credits := res.Credits
			if credits <= 0 {
				credits = 1
			}

			r.mu.Lock()
			key.Model.RequestCount++
			key.Model.RemainingCredits = max(0, 2500-key.Model.RequestCount)
			if key.Model.RequestCount >= 2500 {
				key.Model.Status = models.SerperKeyStatusExhausted
			}
			now := time.Now()
			key.Model.LastUsed = &now
			r.mu.Unlock()

			if r.callback != nil {
				go r.callback.OnKeySuccess(context.Background(), key.Model.ID, credits)
			}
			return res, nil
		}

		lastErr = err

		// Handle Rate Limit 429
		if errors.Is(err, ErrRateLimit) {
			cooldownUntil := time.Now().Add(5 * time.Minute)
			r.mu.Lock()
			key.Model.Status = models.SerperKeyStatusCooldown
			key.Model.CooldownUntil = &cooldownUntil
			key.Model.LastError = "Rate limit (429)"
			r.mu.Unlock()

			if r.callback != nil {
				go r.callback.OnKeyRateLimit(context.Background(), key.Model.ID, cooldownUntil, "Rate limit (429)")
			}
			continue
		}

		// Handle Credits Exhausted 403
		if errors.Is(err, ErrCreditsExhausted) {
			r.mu.Lock()
			key.Model.Status = models.SerperKeyStatusExhausted
			key.Model.RemainingCredits = 0
			key.Model.LastError = "Credits exhausted or invalid key (403)"
			r.mu.Unlock()

			if r.callback != nil {
				go r.callback.OnKeyExhausted(context.Background(), key.Model.ID, "Credits exhausted or invalid key (403)")
			}
			continue
		}

		// Other HTTP errors: record error and try next key
		r.mu.Lock()
		key.Model.FailCount++
		key.Model.LastError = err.Error()
		r.mu.Unlock()
	}

	return nil, fmt.Errorf("all Serper keys failed: %w", lastErr)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
