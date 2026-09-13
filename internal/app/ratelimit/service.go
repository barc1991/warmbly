package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/cache"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

const (
	// Window durations
	WindowMinute = 60 * time.Second
	WindowDaily  = 24 * time.Hour

	// Key prefixes
	KeyPrefixMinute = "rl:min:"

	// Cache TTL for user limits
	LimitsCacheTTL = 5 * time.Minute
)

type RateLimitService interface {
	// Get effective limits for user (considers plan defaults + overrides)
	GetUserLimits(ctx context.Context, userID uuid.UUID) (*models.UserRateLimits, *errx.Error)

	// Check if request is allowed (returns remaining, reset time, or error)
	CheckLimit(ctx context.Context, userID uuid.UUID, category models.RateLimitCategory) (*models.RateLimitStatus, error)

	// Record a request (increments counter)
	RecordRequest(ctx context.Context, userID uuid.UUID, category models.RateLimitCategory) error

	// Check and record in one operation (atomic)
	CheckAndRecord(ctx context.Context, userID uuid.UUID, category models.RateLimitCategory) (*models.RateLimitStatus, error)

	// Admin: Update user limits
	UpdateUserLimits(ctx context.Context, userID uuid.UUID, data *models.UpdateUserRateLimits, adminID uuid.UUID) (*models.UserRateLimits, *errx.Error)
}

type rateLimitService struct {
	repo  repository.RateLimitRepository
	cache *cache.Cache
}

func NewService(cache *cache.Cache, repo repository.RateLimitRepository) RateLimitService {
	return &rateLimitService{
		repo:  repo,
		cache: cache,
	}
}

func (s *rateLimitService) GetUserLimits(ctx context.Context, userID uuid.UUID) (*models.UserRateLimits, *errx.Error) {
	return s.repo.GetUserLimits(ctx, userID)
}

func (s *rateLimitService) CheckLimit(_ context.Context, _ uuid.UUID, category models.RateLimitCategory) (*models.RateLimitStatus, error) {
	return &models.RateLimitStatus{
		Category:  category,
		Limit:     999999,
		Remaining: 999999,
		ResetAt:   time.Now().Add(WindowMinute),
	}, nil
}

func (s *rateLimitService) RecordRequest(ctx context.Context, userID uuid.UUID, category models.RateLimitCategory) error {
	key := s.getMinuteKey(userID, category)

	// Increment counter with expiry
	pipe := s.cache.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, WindowMinute)
	_, err := pipe.Exec(ctx)

	return err
}

func (s *rateLimitService) CheckAndRecord(_ context.Context, _ uuid.UUID, category models.RateLimitCategory) (*models.RateLimitStatus, error) {
	return &models.RateLimitStatus{
		Category:  category,
		Limit:     999999,
		Remaining: 999999,
		ResetAt:   time.Now().Add(WindowMinute),
	}, nil
}

func (s *rateLimitService) UpdateUserLimits(ctx context.Context, userID uuid.UUID, data *models.UpdateUserRateLimits, adminID uuid.UUID) (*models.UserRateLimits, *errx.Error) {
	return s.repo.UpdateUserLimits(ctx, userID, adminID, data)
}

func (s *rateLimitService) getMinuteKey(userID uuid.UUID, category models.RateLimitCategory) string {
	// Key format: rl:min:{user_id}:{category}:{minute_bucket}
	bucket := time.Now().Unix() / 60
	return fmt.Sprintf("%s%s:%s:%d", KeyPrefixMinute, userID.String(), category, bucket)
}
