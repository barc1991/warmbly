package generation

import (
	"strings"
	"sync"
	"time"
)

// Cooldown durations for smart rate limit protection (Free Tier friendly)
const (
	RateLimitCooldown = 5 * time.Minute
	QuotaCooldown     = 30 * time.Minute
	GenericCooldown   = 1 * time.Minute
	SuspendedCooldown = 24 * time.Hour
)

// GeminiErrorType classifies errors returned by Gemini API.
type GeminiErrorType string

const (
	GeminiErrRateLimit     GeminiErrorType = "rate_limit"
	GeminiErrQuotaExceeded GeminiErrorType = "quota_exceeded"
	GeminiErrSuspended     GeminiErrorType = "suspended"
	GeminiErrInvalidKey    GeminiErrorType = "invalid_key"
	GeminiErrModelOverload GeminiErrorType = "model_overload"
	GeminiErrModelNotFound GeminiErrorType = "model_not_found"
	GeminiErrOther         GeminiErrorType = "other"
)

// ClassifyError inspects an error returned by the Gemini API and categorizes it.
func ClassifyError(err error) GeminiErrorType {
	if err == nil {
		return GeminiErrOther
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "consumer_suspended") {
		return GeminiErrSuspended
	}
	if strings.Contains(msg, "api_key_invalid") || strings.Contains(msg, "invalid api key") || strings.Contains(msg, "api key not valid") {
		return GeminiErrInvalidKey
	}
	if strings.Contains(msg, "overloaded") || strings.Contains(msg, "high demand") || strings.Contains(msg, "503") || strings.Contains(msg, "capacity") {
		return GeminiErrModelOverload
	}
	if strings.Contains(msg, "not found") || strings.Contains(msg, "404") || strings.Contains(msg, "is not supported") {
		return GeminiErrModelNotFound
	}
	if strings.Contains(msg, "429") || strings.Contains(msg, "resource_exhausted") || strings.Contains(msg, "rate limit") {
		return GeminiErrRateLimit
	}
	if strings.Contains(msg, "quota") || strings.Contains(msg, "exceeded") {
		return GeminiErrQuotaExceeded
	}
	return GeminiErrOther
}

type keyState struct {
	FailedAt      time.Time
	CooldownUntil time.Time
	FailCount     int
	RequestCount  int
	LastError     string
	Blacklisted   bool
}

// GeminiKeyHealth holds status details for a single key.
type GeminiKeyHealth struct {
	MaskedKey            string `json:"masked_key"`
	Status               string `json:"status"` // active, cooldown, suspended, invalid
	RequestCount         int    `json:"request_count"`
	FailCount            int    `json:"fail_count"`
	RemainingCooldownSec int    `json:"remaining_cooldown_sec,omitempty"`
	LastError            string `json:"last_error,omitempty"`
}

// GeminiHealthReport provides aggregated pool stats.
type GeminiHealthReport struct {
	TotalKeys      int               `json:"total_keys"`
	ActiveKeys     int               `json:"active_keys"`
	InCooldown     int               `json:"in_cooldown"`
	Blacklisted    int               `json:"blacklisted"`
	TotalRotations int64             `json:"total_rotations"`
	TotalRequests  int64             `json:"total_requests"`
	Keys           []GeminiKeyHealth `json:"keys"`
}

// GeminiKeyRotator manages a pool of Gemini API keys with smart rotation and cooldown.
type GeminiKeyRotator struct {
	mu           sync.RWMutex
	keys         []string
	states       map[string]*keyState
	currentIndex int

	totalRequests      int64
	successfulRequests int64
	totalRotations     int64
}

// NewGeminiKeyRotator initializes an empty or pre-seeded rotator.
func NewGeminiKeyRotator(initialKeys ...string) *GeminiKeyRotator {
	r := &GeminiKeyRotator{
		states: make(map[string]*keyState),
	}
	for _, k := range initialKeys {
		r.AddKey(k)
	}
	return r
}

// MaskKey masks an API key safely (e.g. AIzaSyB123...456 -> AIzaSyB1...3456).
func MaskKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) <= 8 {
		return "******"
	}
	if len(trimmed) <= 16 {
		return trimmed[:4] + "..." + trimmed[len(trimmed)-2:]
	}
	return trimmed[:8] + "..." + trimmed[len(trimmed)-4:]
}

// AddKey registers a new key to the rotator if not already present.
func (r *GeminiKeyRotator) AddKey(rawKey string) {
	key := strings.TrimSpace(rawKey)
	if key == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, k := range r.keys {
		if k == key {
			return
		}
	}
	r.keys = append(r.keys, key)
	if _, ok := r.states[key]; !ok {
		r.states[key] = &keyState{}
	}
}

// SetKeys replaces the current key set while preserving existing state for retained keys.
func (r *GeminiKeyRotator) SetKeys(rawKeys []string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	newKeys := make([]string, 0, len(rawKeys))
	seen := make(map[string]bool)

	for _, raw := range rawKeys {
		k := strings.TrimSpace(raw)
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		newKeys = append(newKeys, k)
		if _, ok := r.states[k]; !ok {
			r.states[k] = &keyState{}
		}
	}
	r.keys = newKeys
	if r.currentIndex >= len(r.keys) {
		r.currentIndex = 0
	}
}

// KeyCount returns total keys registered.
func (r *GeminiKeyRotator) KeyCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.keys)
}

// GetKey selects the next available non-cooldown key in round-robin.
// If all keys are in cooldown, it returns the key with the shortest remaining wait.
func (r *GeminiKeyRotator) GetKey() (string, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	n := len(r.keys)
	if n == 0 {
		return "", false
	}

	now := time.Now()
	startIndex := r.currentIndex

	// Try round-robin search for an active key
	for attempts := 0; attempts < n; attempts++ {
		idx := (startIndex + attempts) % n
		key := r.keys[idx]
		st := r.states[key]
		if st == nil {
			st = &keyState{}
			r.states[key] = st
		}

		if st.Blacklisted {
			continue
		}

		// Check if key is available or cooldown expired
		if st.CooldownUntil.IsZero() || st.CooldownUntil.Before(now) {
			// Clear expired cooldown
			if !st.CooldownUntil.IsZero() && st.CooldownUntil.Before(now) {
				st.CooldownUntil = time.Time{}
				st.LastError = ""
			}
			st.RequestCount++
			r.totalRequests++
			r.currentIndex = (idx + 1) % n
			return key, true
		}
	}

	// If all keys are in cooldown, find the one with shortest remaining wait (excluding blacklisted)
	var bestKey string
	var shortestWait time.Duration = 1<<63 - 1

	for _, key := range r.keys {
		st := r.states[key]
		if st == nil || st.Blacklisted {
			continue
		}
		wait := st.CooldownUntil.Sub(now)
		if wait < shortestWait {
			shortestWait = wait
			bestKey = key
		}
	}

	if bestKey != "" {
		st := r.states[bestKey]
		st.RequestCount++
		r.totalRequests++
		return bestKey, true
	}

	return "", false
}

// MarkSuccess notes a successful API call for the key.
func (r *GeminiKeyRotator) MarkSuccess(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st, ok := r.states[key]
	if !ok {
		return
	}
	st.FailCount = 0
	st.LastError = ""
	st.CooldownUntil = time.Time{}
	r.successfulRequests++
}

// MarkFailed notes a failure, classifies the error, and applies cooldown or blacklisting.
func (r *GeminiKeyRotator) MarkFailed(key string, err error) {
	if err == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	st, ok := r.states[key]
	if !ok {
		st = &keyState{}
		r.states[key] = st
	}

	now := time.Now()
	errMsg := strings.ToLower(err.Error())

	st.FailedAt = now
	st.FailCount++
	st.LastError = err.Error()
	r.totalRotations++

	if strings.Contains(errMsg, "consumer_suspended") || strings.Contains(errMsg, "api_key_invalid") || strings.Contains(errMsg, "invalid api key") || strings.Contains(errMsg, "api key not valid") {
		// Permanently blacklisted
		st.Blacklisted = true
		st.CooldownUntil = now.Add(SuspendedCooldown)
		return
	}

	if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "resource_exhausted") || strings.Contains(errMsg, "rate limit") {
		st.CooldownUntil = now.Add(RateLimitCooldown)
		return
	}

	if strings.Contains(errMsg, "quota") || strings.Contains(errMsg, "exceeded") {
		st.CooldownUntil = now.Add(QuotaCooldown)
		return
	}

	// Default transient error cooldown
	st.CooldownUntil = now.Add(GenericCooldown)
}

// GetHealthReport outputs current health metrics.
func (r *GeminiKeyRotator) GetHealthReport() GeminiHealthReport {
	r.mu.RLock()
	defer r.mu.RUnlock()

	now := time.Now()
	rep := GeminiHealthReport{
		TotalKeys:      len(r.keys),
		TotalRotations: r.totalRotations,
		TotalRequests:  r.totalRequests,
		Keys:           make([]GeminiKeyHealth, 0, len(r.keys)),
	}

	for _, key := range r.keys {
		st := r.states[key]
		masked := MaskKey(key)
		kh := GeminiKeyHealth{
			MaskedKey: masked,
		}

		if st == nil {
			kh.Status = "active"
			rep.ActiveKeys++
		} else if st.Blacklisted {
			kh.Status = "suspended"
			kh.LastError = st.LastError
			kh.FailCount = st.FailCount
			kh.RequestCount = st.RequestCount
			rep.Blacklisted++
		} else if !st.CooldownUntil.IsZero() && st.CooldownUntil.After(now) {
			kh.Status = "cooldown"
			kh.RemainingCooldownSec = int(st.CooldownUntil.Sub(now).Seconds())
			kh.LastError = st.LastError
			kh.FailCount = st.FailCount
			kh.RequestCount = st.RequestCount
			rep.InCooldown++
		} else {
			kh.Status = "active"
			kh.RequestCount = st.RequestCount
			kh.FailCount = st.FailCount
			rep.ActiveKeys++
		}
		rep.Keys = append(rep.Keys, kh)
	}

	return rep
}
