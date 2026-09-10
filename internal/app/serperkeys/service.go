package serperkeys

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/app/cipher"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/cache"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/pkg/generation"
	"github.com/warmbly/warmbly/internal/pkg/serper"
	"github.com/warmbly/warmbly/internal/repository"
)

// CreateKeyInput represents a single Serper key to add.
type CreateKeyInput struct {
	Name string `json:"name"`
	Key  string `json:"key"`
}

// TestKeyResult holds the outcome of an active Serper API test.
type TestKeyResult struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
	Info      string `json:"info,omitempty"`
	Error     string `json:"error,omitempty"`
}

// Service manages org-scoped Serper keys, rotators, and cached Google search.
type Service interface {
	ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, *errx.Error)
	CreateKeys(ctx context.Context, orgID uuid.UUID, inputs []CreateKeyInput) ([]*models.OrgSerperKey, *errx.Error)
	DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) *errx.Error
	UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.SerperKeyStatus) *errx.Error
	TestKey(ctx context.Context, orgID, keyID uuid.UUID) (*TestKeyResult, *errx.Error)
	GetStats(ctx context.Context, orgID uuid.UUID) (*models.SerperRotationStats, *errx.Error)
	GetBDRSettings(ctx context.Context, orgID uuid.UUID) (*models.BDRSettings, *errx.Error)
	UpdateBDRSettings(ctx context.Context, orgID uuid.UUID, s *models.BDRSettings) *errx.Error
	Search(ctx context.Context, orgID uuid.UUID, query string, num int) (*serper.SearchResponse, error)
	GetRotatorForOrg(ctx context.Context, orgID uuid.UUID) (*serper.SerperKeyRotator, error)
	InvalidateOrg(orgID uuid.UUID)
}

type service struct {
	repo   repository.SerperKeysRepository
	cipher cipher.CipherService
	cache  *cache.Cache
	client *serper.Client

	rotatorsMu sync.RWMutex
	rotators   map[uuid.UUID]*serper.SerperKeyRotator
}

// NewService constructs a Serper keys application service.
func NewService(repo repository.SerperKeysRepository, cipherSvc cipher.CipherService, c *cache.Cache) Service {
	return &service{
		repo:     repo,
		cipher:   cipherSvc,
		cache:    c,
		client:   serper.NewClient(),
		rotators: make(map[uuid.UUID]*serper.SerperKeyRotator),
	}
}

func (s *service) InvalidateOrg(orgID uuid.UUID) {
	s.rotatorsMu.Lock()
	delete(s.rotators, orgID)
	s.rotatorsMu.Unlock()
}

func (s *service) ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, *errx.Error) {
	keys, err := s.repo.ListKeys(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to list Serper keys")
	}
	if keys == nil {
		keys = []*models.OrgSerperKey{}
	}
	return keys, nil
}

func (s *service) CreateKeys(ctx context.Context, orgID uuid.UUID, inputs []CreateKeyInput) ([]*models.OrgSerperKey, *errx.Error) {
	if len(inputs) == 0 {
		return nil, errx.New(errx.BadRequest, "no keys provided")
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "encryption service unavailable")
	}

	created := make([]*models.OrgSerperKey, 0, len(inputs))
	for idx, in := range inputs {
		rawKey := strings.TrimSpace(in.Key)
		if rawKey == "" {
			continue
		}

		name := strings.TrimSpace(in.Name)
		if name == "" {
			name = fmt.Sprintf("Serper Key %d", idx+1)
		}

		masked := generation.MaskKey(rawKey)
		encKey, err := c.Encrypt(ctx, rawKey)
		if err != nil {
			return nil, errx.New(errx.Internal, "failed to encrypt key")
		}

		k := &models.OrgSerperKey{
			OrgID:            orgID,
			Name:             name,
			MaskedKey:        masked,
			EncryptedKey:     encKey,
			Status:           models.SerperKeyStatusActive,
			RemainingCredits: 2500,
		}

		saved, err := s.repo.CreateKey(ctx, k)
		if err != nil {
			// Skip duplicate key errors gracefully
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				continue
			}
			return nil, errx.New(errx.Internal, fmt.Sprintf("failed to save key %s: %v", name, err))
		}
		created = append(created, saved)
	}

	s.InvalidateOrg(orgID)
	return created, nil
}

func (s *service) DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) *errx.Error {
	if err := s.repo.DeleteKey(ctx, orgID, keyID); err != nil {
		return errx.New(errx.NotFound, "key not found")
	}
	s.InvalidateOrg(orgID)
	return nil
}

func (s *service) UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.SerperKeyStatus) *errx.Error {
	if err := s.repo.UpdateKeyStatus(ctx, orgID, keyID, status); err != nil {
		return errx.New(errx.Internal, "failed to update key status")
	}
	s.InvalidateOrg(orgID)
	return nil
}

func (s *service) TestKey(ctx context.Context, orgID, keyID uuid.UUID) (*TestKeyResult, *errx.Error) {
	k, err := s.repo.GetKey(ctx, orgID, keyID)
	if err != nil {
		return nil, errx.New(errx.NotFound, "key not found")
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "encryption service unavailable")
	}

	decKey, err := c.Decrypt(ctx, k.EncryptedKey)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to decrypt key")
	}

	success, latency, info, testErr := s.client.TestKey(ctx, decKey)
	if testErr != nil {
		return &TestKeyResult{
			Success:   false,
			LatencyMs: latency,
			Error:     testErr.Error(),
		}, nil
	}

	return &TestKeyResult{
		Success:   success,
		LatencyMs: latency,
		Info:      info,
	}, nil
}

func (s *service) GetStats(ctx context.Context, orgID uuid.UUID) (*models.SerperRotationStats, *errx.Error) {
	stats, err := s.repo.GetRotationStats(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to get rotation stats")
	}
	return stats, nil
}

func (s *service) GetBDRSettings(ctx context.Context, orgID uuid.UUID) (*models.BDRSettings, *errx.Error) {
	st, err := s.repo.GetBDRSettings(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to load BDR settings")
	}
	return st, nil
}

func (s *service) UpdateBDRSettings(ctx context.Context, orgID uuid.UUID, st *models.BDRSettings) *errx.Error {
	if st == nil {
		return errx.New(errx.BadRequest, "empty settings")
	}
	if err := s.repo.UpdateBDRSettings(ctx, orgID, st); err != nil {
		return errx.New(errx.Internal, "failed to update BDR settings")
	}
	return nil
}

// Search queries Google via Serper, backed by a 7-day multi-tier cache.
func (s *service) Search(ctx context.Context, orgID uuid.UUID, query string, num int) (*serper.SearchResponse, error) {
	qNorm := strings.ToLower(strings.TrimSpace(query))
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", qNorm, num)))
	qHash := hex.EncodeToString(sum[:])
	cacheKey := fmt.Sprintf("serper:search:%s:%s", orgID.String(), qHash)

	// Tier 1: Memory/Redis cache check
	if s.cache != nil {
		var cached serper.SearchResponse
		if err := s.cache.GetJSON(ctx, cacheKey, &cached); err == nil && len(cached.Organic) > 0 {
			return &cached, nil
		}
	}

	// Tier 2: Persistent database cache check
	if rawDB, err := s.repo.GetCachedSearch(ctx, orgID, qHash); err == nil && len(rawDB) > 0 {
		var res serper.SearchResponse
		if err := json.Unmarshal(rawDB, &res); err == nil && len(res.Organic) > 0 {
			if s.cache != nil {
				_ = s.cache.SetJSON(ctx, cacheKey, &res, 7*24*time.Hour)
			}
			return &res, nil
		}
	}

	// Tier 3: Live search through Serper Rotator
	rotator, err := s.GetRotatorForOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}

	res, err := rotator.Search(ctx, query, num)
	if err != nil {
		return nil, err
	}

	// Persist in 7-day caches
	rawJSON, _ := json.Marshal(res)
	if len(rawJSON) > 0 {
		_ = s.repo.SetCachedSearch(ctx, orgID, qHash, query, rawJSON)
		if s.cache != nil {
			_ = s.cache.SetJSON(ctx, cacheKey, res, 7*24*time.Hour)
		}
	}

	return res, nil
}

func (s *service) GetRotatorForOrg(ctx context.Context, orgID uuid.UUID) (*serper.SerperKeyRotator, error) {
	s.rotatorsMu.RLock()
	r, ok := s.rotators[orgID]
	s.rotatorsMu.RUnlock()
	if ok && r != nil {
		return r, nil
	}

	keys, err := s.repo.ListActiveKeys(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to list active serper keys: %w", err)
	}
	if len(keys) == 0 {
		return nil, serper.ErrNoActiveSerperKeys
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get cipher: %w", err)
	}

	var managed []*serper.ManagedKey
	for _, k := range keys {
		dec, err := c.Decrypt(ctx, k.EncryptedKey)
		if err != nil {
			continue
		}
		managed = append(managed, &serper.ManagedKey{
			Model:        k,
			DecryptedKey: dec,
		})
	}

	if len(managed) == 0 {
		return nil, serper.ErrNoActiveSerperKeys
	}

	cb := &rotatorCallback{repo: s.repo}
	rotator := serper.NewSerperKeyRotator(orgID, managed, s.client, cb)

	s.rotatorsMu.Lock()
	s.rotators[orgID] = rotator
	s.rotatorsMu.Unlock()

	return rotator, nil
}

type rotatorCallback struct {
	repo repository.SerperKeysRepository
}

func (c *rotatorCallback) OnKeySuccess(ctx context.Context, keyID uuid.UUID, credits int) {
	_ = c.repo.RecordKeySuccess(ctx, keyID, credits)
}

func (c *rotatorCallback) OnKeyRateLimit(ctx context.Context, keyID uuid.UUID, cooldownUntil time.Time, errMsg string) {
	_ = c.repo.RecordKeyRateLimit(ctx, keyID, cooldownUntil, errMsg)
}

func (c *rotatorCallback) OnKeyExhausted(ctx context.Context, keyID uuid.UUID, errMsg string) {
	_ = c.repo.RecordKeyExhausted(ctx, keyID, errMsg)
}
