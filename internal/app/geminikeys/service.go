package geminikeys

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"google.golang.org/genai"

	"github.com/warmbly/warmbly/internal/app/cipher"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/pkg/generation"
	"github.com/warmbly/warmbly/internal/repository"
)

// CreateKeyInput represents a single key to add.
type CreateKeyInput struct {
	Name string `json:"name"`
	Key  string `json:"key"`
}

// TestKeyResult holds the outcome of an active API connectivity test.
type TestKeyResult struct {
	Success   bool   `json:"success"`
	Model     string `json:"model,omitempty"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
	Error     string `json:"error,omitempty"`
	ErrorType string `json:"error_type,omitempty"`
}

// Service manages org-scoped Gemini keys, rotators, and runtime providers.
type Service interface {
	ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, *errx.Error)
	CreateKeys(ctx context.Context, orgID uuid.UUID, inputs []CreateKeyInput) ([]*models.OrgGeminiKey, *errx.Error)
	DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) *errx.Error
	UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.GeminiKeyStatus) *errx.Error
	TestKey(ctx context.Context, orgID, keyID uuid.UUID) (*TestKeyResult, *errx.Error)
	GetConfig(ctx context.Context, orgID uuid.UUID) (*models.GeminiOrgConfig, *models.GeminiRotationStats, *errx.Error)
	UpdateConfig(ctx context.Context, orgID uuid.UUID, cfg *models.GeminiOrgConfig) *errx.Error
	GetRotatorForOrg(ctx context.Context, orgID uuid.UUID) (*generation.GeminiKeyRotator, error)
	GetProviderForOrg(ctx context.Context, orgID uuid.UUID) (generation.Provider, error)
	InvalidateOrg(orgID uuid.UUID)
}

type orgRuntime struct {
	rotator  *generation.GeminiKeyRotator
	provider generation.Provider
	loadedAt time.Time
}

type service struct {
	repo   repository.GeminiKeysRepository
	cipher cipher.CipherService

	runtimesMu sync.RWMutex
	runtimes   map[uuid.UUID]*orgRuntime
}

// NewService constructs a Gemini keys application service.
func NewService(repo repository.GeminiKeysRepository, cipherSvc cipher.CipherService) Service {
	return &service{
		repo:     repo,
		cipher:   cipherSvc,
		runtimes: make(map[uuid.UUID]*orgRuntime),
	}
}

func (s *service) InvalidateOrg(orgID uuid.UUID) {
	s.runtimesMu.Lock()
	delete(s.runtimes, orgID)
	s.runtimesMu.Unlock()
}

func (s *service) ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, *errx.Error) {
	keys, err := s.repo.ListKeys(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to list Gemini keys")
	}
	return keys, nil
}

func (s *service) CreateKeys(ctx context.Context, orgID uuid.UUID, inputs []CreateKeyInput) ([]*models.OrgGeminiKey, *errx.Error) {
	if len(inputs) == 0 {
		return nil, errx.New(errx.BadRequest, "no keys provided")
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "encryption service unavailable")
	}

	created := make([]*models.OrgGeminiKey, 0, len(inputs))
	for idx, in := range inputs {
		rawKey := strings.TrimSpace(in.Key)
		if rawKey == "" {
			continue
		}

		name := strings.TrimSpace(in.Name)
		if name == "" {
			name = fmt.Sprintf("Key %d", idx+1)
		}

		masked := generation.MaskKey(rawKey)
		encKey, err := c.Encrypt(ctx, rawKey)
		if err != nil {
			return nil, errx.New(errx.Internal, "failed to encrypt key")
		}

		k := &models.OrgGeminiKey{
			OrgID:        orgID,
			Name:         name,
			MaskedKey:    masked,
			EncryptedKey: encKey,
			Status:       models.GeminiKeyStatusActive,
		}

		kCreated, err := s.repo.CreateKey(ctx, k)
		if err != nil {
			// Skip duplicate key collisions gracefully
			continue
		}
		created = append(created, kCreated)
	}

	s.InvalidateOrg(orgID)
	return created, nil
}

func (s *service) DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) *errx.Error {
	if err := s.repo.DeleteKey(ctx, orgID, keyID); err != nil {
		return errx.New(errx.Internal, "failed to delete Gemini key")
	}
	s.InvalidateOrg(orgID)
	return nil
}

func (s *service) UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.GeminiKeyStatus) *errx.Error {
	if err := s.repo.UpdateKeyStatus(ctx, orgID, keyID, status); err != nil {
		return errx.New(errx.Internal, "failed to update key status")
	}
	s.InvalidateOrg(orgID)
	return nil
}

func (s *service) TestKey(ctx context.Context, orgID, keyID uuid.UUID) (*TestKeyResult, *errx.Error) {
	keyRow, err := s.repo.GetKey(ctx, orgID, keyID)
	if err != nil || keyRow == nil {
		return nil, errx.New(errx.NotFound, "key not found")
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "encryption service unavailable")
	}

	plainKey, err := c.Decrypt(ctx, keyRow.EncryptedKey)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to decrypt key")
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  plainKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return &TestKeyResult{
			Success:   false,
			Error:     err.Error(),
			ErrorType: string(generation.ClassifyError(err)),
		}, nil
	}

	cfg, _ := s.repo.GetConfig(ctx, orgID)
	testModel := generation.GeminiModel38Flash
	if cfg != nil && cfg.PrimaryModel != "" {
		testModel = cfg.PrimaryModel
	}

	start := time.Now()
	testPrompt := []*genai.Content{
		{
			Role:  "user",
			Parts: []*genai.Part{genai.NewPartFromText("Reply with 'pong'")},
		},
	}
	config := &genai.GenerateContentConfig{
		MaxOutputTokens: 10,
	}

	resp, genErr := client.Models.GenerateContent(ctx, testModel, testPrompt, config)
	latency := time.Since(start).Milliseconds()

	if genErr != nil {
		errType := generation.ClassifyError(genErr)
		_ = s.repo.UpdateKeyStats(ctx, keyID, 1, 1, genErr.Error(), nil, keyRow.Status)
		return &TestKeyResult{
			Success:   false,
			Model:     testModel,
			LatencyMs: latency,
			Error:     genErr.Error(),
			ErrorType: string(errType),
		}, nil
	}

	// Succeeded
	_ = s.repo.UpdateKeyStats(ctx, keyID, 1, 0, "", nil, models.GeminiKeyStatusActive)
	_ = resp

	return &TestKeyResult{
		Success:   true,
		Model:     testModel,
		LatencyMs: latency,
	}, nil
}

func (s *service) GetConfig(ctx context.Context, orgID uuid.UUID) (*models.GeminiOrgConfig, *models.GeminiRotationStats, *errx.Error) {
	cfg, err := s.repo.GetConfig(ctx, orgID)
	if err != nil {
		return nil, nil, errx.New(errx.Internal, "failed to load Gemini config")
	}

	keys, err := s.repo.ListKeys(ctx, orgID)
	if err != nil {
		return nil, nil, errx.New(errx.Internal, "failed to load keys")
	}

	stats := &models.GeminiRotationStats{
		TotalKeys:     len(keys),
		CurrentModel:  cfg.PrimaryModel,
		FallbackChain: cfg.FallbackChain,
	}

	now := time.Now()
	for _, k := range keys {
		stats.TotalRequests += int64(k.RequestCount)
		stats.TotalRotations += int64(k.FailCount)
		switch {
		case k.Status == models.GeminiKeyStatusDisabled || k.Status == models.GeminiKeyStatusPaused:
			stats.DisabledKeys++
		case k.CooldownUntil != nil && k.CooldownUntil.After(now):
			stats.CooldownKeys++
		default:
			stats.ActiveKeys++
		}
	}

	return cfg, stats, nil
}

func (s *service) UpdateConfig(ctx context.Context, orgID uuid.UUID, cfg *models.GeminiOrgConfig) *errx.Error {
	if cfg.PrimaryModel == "" {
		cfg.PrimaryModel = generation.GeminiModelPrimary
	}
	if len(cfg.FallbackChain) == 0 {
		cfg.FallbackChain = generation.DefaultGeminiFallbackChain
	}

	if err := s.repo.UpdateConfig(ctx, orgID, cfg); err != nil {
		return errx.New(errx.Internal, "failed to update Gemini config")
	}
	s.InvalidateOrg(orgID)
	return nil
}

func (s *service) getOrLoadRuntime(ctx context.Context, orgID uuid.UUID) (*orgRuntime, error) {
	s.runtimesMu.RLock()
	rt, ok := s.runtimes[orgID]
	s.runtimesMu.RUnlock()
	if ok && time.Since(rt.loadedAt) < 5*time.Minute {
		return rt, nil
	}

	s.runtimesMu.Lock()
	defer s.runtimesMu.Unlock()
	if rt, ok := s.runtimes[orgID]; ok && time.Since(rt.loadedAt) < 5*time.Minute {
		return rt, nil
	}

	activeKeys, err := s.repo.ListActiveKeys(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if len(activeKeys) == 0 {
		return nil, nil
	}

	c, err := s.cipher.Cipher(ctx, orgID)
	if err != nil {
		return nil, err
	}

	plainKeys := make([]string, 0, len(activeKeys))
	for _, k := range activeKeys {
		pk, err := c.Decrypt(ctx, k.EncryptedKey)
		if err == nil && pk != "" {
			plainKeys = append(plainKeys, pk)
		}
	}

	if len(plainKeys) == 0 {
		return nil, nil
	}

	cfg, _ := s.repo.GetConfig(ctx, orgID)
	primary := generation.GeminiModelPrimary
	chain := generation.DefaultGeminiFallbackChain
	if cfg != nil {
		if cfg.PrimaryModel != "" {
			primary = cfg.PrimaryModel
		}
		if len(cfg.FallbackChain) > 0 {
			chain = cfg.FallbackChain
		}
	}

	rotator := generation.NewGeminiKeyRotator(plainKeys...)
	providerCfg := generation.ProviderConfig{
		GeminiRotator:       rotator,
		GeminiPrimaryModel:  primary,
		GeminiFallbackChain: chain,
	}

	p, err := generation.NewProvider(providerCfg)
	if err != nil {
		return nil, err
	}

	rt = &orgRuntime{
		rotator:  rotator,
		provider: p,
		loadedAt: time.Now(),
	}
	s.runtimes[orgID] = rt
	return rt, nil
}

func (s *service) GetRotatorForOrg(ctx context.Context, orgID uuid.UUID) (*generation.GeminiKeyRotator, error) {
	rt, err := s.getOrLoadRuntime(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, nil
	}
	return rt.rotator, nil
}

func (s *service) GetProviderForOrg(ctx context.Context, orgID uuid.UUID) (generation.Provider, error) {
	rt, err := s.getOrLoadRuntime(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, nil
	}
	return rt.provider, nil
}
