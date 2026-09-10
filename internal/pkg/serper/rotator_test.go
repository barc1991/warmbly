package serper

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
)

func TestRotatorKeySelection(t *testing.T) {
	orgID := uuid.New()
	k1 := &ManagedKey{
		Model: &models.OrgSerperKey{
			ID:               uuid.New(),
			Status:           models.SerperKeyStatusActive,
			RemainingCredits: 2500,
		},
		DecryptedKey: "key-1",
	}
	k2 := &ManagedKey{
		Model: &models.OrgSerperKey{
			ID:               uuid.New(),
			Status:           models.SerperKeyStatusExhausted,
			RemainingCredits: 0,
		},
		DecryptedKey: "key-2",
	}
	future := time.Now().Add(10 * time.Minute)
	k3 := &ManagedKey{
		Model: &models.OrgSerperKey{
			ID:               uuid.New(),
			Status:           models.SerperKeyStatusCooldown,
			CooldownUntil:    &future,
			RemainingCredits: 1000,
		},
		DecryptedKey: "key-3",
	}

	rotator := NewSerperKeyRotator(orgID, []*ManagedKey{k1, k2, k3}, nil, nil)
	if rotator.KeyCount() != 3 {
		t.Fatalf("expected 3 keys, got %d", rotator.KeyCount())
	}

	selected, err := rotator.PickKey()
	if err != nil {
		t.Fatalf("expected active key, got error %v", err)
	}
	if selected.DecryptedKey != "key-1" {
		t.Fatalf("expected key-1, got %s", selected.DecryptedKey)
	}

	// Mark k1 exhausted
	k1.Model.RequestCount = 2500
	k1.Model.Status = models.SerperKeyStatusExhausted

	_, err = rotator.PickKey()
	if err != ErrNoActiveSerperKeys {
		t.Fatalf("expected ErrNoActiveSerperKeys, got %v", err)
	}
}
