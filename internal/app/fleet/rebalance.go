// Package fleet runs the autonomous control loops that manage the worker fleet
// without operator clicks: rotating mailboxes off workers that can no longer
// carry them, scaling up when capacity runs out, and draining quarantined
// machines.
//
// Every action is recorded in decision_log so admins can audit what the system
// did and why.
package fleet

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	workerapp "github.com/warmbly/warmbly/internal/app/worker"
	"github.com/warmbly/warmbly/internal/jobrun"
	"github.com/warmbly/warmbly/internal/repository"
)

// Rotator moves mailboxes off workers that should not be carrying them.
//
// It is deliberately reluctant. Every move changes the client IP a mailbox's
// provider sees, and providers read a moving sign-in location as risk: Google
// challenges the login, and both Google and Microsoft throttle authentication
// per address. So the loop only considers mailboxes whose worker is dead,
// degraded or over capacity, and even then a mailbox has to clear a residency
// floor and the destination has to score materially better before anything
// moves. A fleet where nothing rotates is a healthy fleet, not a broken loop.
type Rotator struct {
	WorkerRepo repository.WorkerRepository
	Assignment workerapp.WorkerAssignmentService
	Decisions  repository.DecisionLogRepository

	// MaxMovesPerTick bounds how much churn one pass can create, so a fleet-wide
	// event (a bad deploy, a provider outage) degrades gracefully instead of
	// re-placing everything at once.
	MaxMovesPerTick int
	// ScanLimit bounds how many candidate mailboxes one pass examines.
	ScanLimit int
	Interval  time.Duration
}

func (r *Rotator) defaults() {
	if r.MaxMovesPerTick == 0 {
		r.MaxMovesPerTick = 50
	}
	if r.ScanLimit == 0 {
		r.ScanLimit = 500
	}
	if r.Interval == 0 {
		r.Interval = 5 * time.Minute
	}
}

// Run blocks until ctx is cancelled, ticking every Interval.
func (r *Rotator) Run(ctx context.Context) {
	r.defaults()
	jobrun.Loop(ctx, "fleet_rotate", r.Interval, false, r.tick)
}

func (r *Rotator) tick(ctx context.Context) error {
	if r.Assignment == nil {
		return nil
	}
	candidates, err := r.WorkerRepo.ListRotationCandidates(ctx, workerapp.RotationHotUtilization, r.ScanLimit)
	if err != nil {
		return err
	}

	now := time.Now()
	moved := 0
	for _, state := range candidates {
		if moved >= r.MaxMovesPerTick {
			break
		}
		if state.WorkerID == nil || state.OrganizationID == nil {
			continue
		}

		awayFromOwn := state.ReservedWorkerID != nil && *state.ReservedWorkerID != *state.WorkerID
		urgency, reason := workerapp.EvaluateRotation(workerapp.RotationInput{
			WorkerActive:                 state.WorkerActive,
			WorkerLive:                   state.WorkerLive,
			WorkerHealth:                 state.WorkerHealth,
			WorkerUtilization:            state.WorkerUtilization,
			Residency:                    state.Residency(now),
			OnSomeoneElsesReservedWorker: state.WorkerReservedForOtherOrg,
			AwayFromOwnReservedWorker:    awayFromOwn,
		})
		if urgency == workerapp.RotationStay {
			continue
		}
		if !workerapp.MayMove(urgency, state.Residency(now)) {
			continue
		}

		res, err := r.Assignment.SelectWorkerFor(ctx, workerapp.PlacementLookup{
			EmailAccountID:  state.EmailAccountID,
			OrgID:           *state.OrganizationID,
			CurrentWorkerID: state.WorkerID,
			Region:          state.WorkerRegion,
		})
		if err != nil || res == nil || res.Worker == nil {
			continue
		}
		if res.Worker.ID == *state.WorkerID {
			continue
		}
		if !workerapp.WorthMoving(urgency, res.IncumbentScore, res.Score) {
			continue
		}

		from := *state.WorkerID
		if err := r.Assignment.MoveMailbox(ctx, state.EmailAccountID, &from, res.Worker.ID); err != nil {
			log.Warn().Err(err).Str("mailbox", state.EmailAccountID.String()).Msg("rotation move failed")
			continue
		}
		moved++

		mailboxID := state.EmailAccountID
		_ = r.Decisions.Insert(ctx, &repository.DecisionLog{
			Kind:      "rotate",
			WorkerID:  &from,
			MailboxID: &mailboxID,
			Reason: fmt.Sprintf("%s; moved to %s (score %.2f vs %.2f)",
				reason, res.Worker.ID, res.Score, res.IncumbentScore),
			TriggeredBy: "auto:rotate",
		})
	}

	if moved > 0 {
		log.Info().Int("moved", moved).Int("scanned", len(candidates)).Msg("rotation pass complete")
	}
	return nil
}

// DrainWorker moves every mailbox off one worker, ignoring residency. Used by
// the admin drain action and by the quarantine loop when a worker is blocked.
func (r *Rotator) DrainWorker(ctx context.Context, workerID uuid.UUID) error {
	if r.Assignment == nil {
		return nil
	}
	return r.Assignment.MigrateEmailsFromWorker(ctx, workerID)
}
