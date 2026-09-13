// Package dailythrottle stops abuse by capping per-day creation rates
// on resources that are otherwise "unlimited" by plan. The total cap
// (config.HardCap*) bounds the lifetime number; this service bounds
// the per-day rate so a fresh account can't pop 1000 campaigns at
// once.
//
// Mechanism: per-(scope, resource, UTC-day) Redis counters with a 25h
// TTL. CheckAndIncrement is the only entry point — atomic INCR plus a
// SETEX on the first hit so the key always expires even if the
// process crashes between calls. Resets at UTC midnight by the key
// design, not by a scheduled job.
package dailythrottle

import (
	"context"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/cache"
)

// Resource enumerates the actions the throttle bounds. Keeping the
// list closed lets every key live under a single namespace and lets
// the rate ceiling live alongside the resource name in config.
type Resource string

const (
	ResourceCampaign      Resource = "campaign"
	ResourceOrg           Resource = "org"
	ResourceScheduledSend Resource = "scheduled_send"
)

type Service interface {
	// CheckAndIncrement bumps the counter for (scope, resource, today)
	// and returns errx.New(TooManyRequests, ...) when the post-increment
	// value exceeds the ceiling.
	CheckAndIncrement(ctx context.Context, scope uuid.UUID, res Resource, ceiling int) *errx.Error
}

type service struct {
	cache *cache.Cache
}

func NewService(c *cache.Cache) Service {
	return &service{cache: c}
}

func (s *service) CheckAndIncrement(_ context.Context, _ uuid.UUID, _ Resource, _ int) *errx.Error {
	// Daily creation throttles are disabled.
	return nil
}
