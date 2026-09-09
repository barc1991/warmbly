package seed

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedWorkers(ctx context.Context, pool *pgxpool.Pool, r *Result) error {
	type worker struct {
		id     uuid.UUID
		name   string
		ipAddr string
		notes  string
		region string
	}
	workers := []worker{
		{id: WorkerFreeID, name: "worker-1", ipAddr: "10.0.0.11", region: "eu-central", notes: "Fleet worker"},
		{id: WorkerSharedID, name: "worker-2", ipAddr: "10.0.0.12", region: "eu-central", notes: "Fleet worker"},
		{id: WorkerDedicatedID, name: "worker-3", ipAddr: "10.0.0.13", region: "us-east", notes: "Reserved for the enterprise org"},
	}

	for _, w := range workers {
		_, err := pool.Exec(ctx, `
			INSERT INTO workers (id, name, notes, ip_addr, active, region, account_count, created_at, updated_at)
			VALUES ($1,$2,$3,$4,TRUE,$5,0,$6,$6)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				notes = EXCLUDED.notes,
				ip_addr = EXCLUDED.ip_addr,
				active = TRUE,
				region = EXCLUDED.region,
				updated_at = NOW()
		`, w.id, w.name, w.notes, w.ipAddr, w.region, time.Now())
		if err != nil {
			return err
		}
		r.Workers = append(r.Workers, SeededWorker{Name: w.name, Region: w.region, ID: w.id.String()})
	}
	return nil
}

func seedWorkerAssignments(ctx context.Context, pool *pgxpool.Pool, _ *Result) error {
	// Acme (Pro plan) reserves a worker for isolated egress. Use a stable
	// assignment ID so re-running the seed updates rather than duplicates.
	assignmentID := uuid.MustParse("00000000-0000-0000-0000-000000000280")
	_, err := pool.Exec(ctx, `
		INSERT INTO dedicated_worker_assignments (id, worker_id, organization_id, subscription_id, assigned_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (id) DO NOTHING
	`, assignmentID, WorkerDedicatedID, OrgAcmeID, SubAcmeID)
	return err
}
