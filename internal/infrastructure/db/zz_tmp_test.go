package db

import (
	"errors"
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func inst(t *testing.T) *migrate.Migrate {
	dsn := os.Getenv("MIG_DSN")
	if dsn == "" {
		t.Skip("no dsn")
	}
	src, _ := iofs.New(migrationsFS, "migrations")
	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func TestTmpUpDown(t *testing.T) {
	m := inst(t)
	defer m.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		t.Fatal("up:", err)
	}
	// Both new migrations must round-trip.
	if err := m.Steps(-2); err != nil {
		t.Fatal("down 2:", err)
	}
	if err := m.Steps(2); err != nil {
		t.Fatal("re-up 2:", err)
	}
}
