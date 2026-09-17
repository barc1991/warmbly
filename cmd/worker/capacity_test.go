package main

import "testing"

func TestWorkerCapacityTarget(t *testing.T) {
	t.Setenv("WARMBLY_WORKER_CAPACITY", "250")
	if got := workerCapacityTarget(); got != 250 {
		t.Fatalf("configured capacity = %.0f, want 250", got)
	}

	t.Setenv("WARMBLY_WORKER_CAPACITY", "")
	if got := workerCapacityTarget(); got != 100 {
		t.Fatalf("default capacity = %.0f, want 100", got)
	}

	t.Setenv("WARMBLY_WORKER_CAPACITY", "invalid")
	if got := workerCapacityTarget(); got != 100 {
		t.Fatalf("invalid capacity = %.0f, want safe default 100", got)
	}
}
