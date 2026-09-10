package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/app/cipher"
	"github.com/warmbly/warmbly/internal/infrastructure/kms"
	"github.com/warmbly/warmbly/internal/models"
)

type mockOAuthSlotRepo struct {
	listFn          func(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error)
	getByIDFn       func(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error)
	getRawByIDFn    func(ctx context.Context, slotID uuid.UUID) (*models.OAuthConnectionSlot, error)
	getAvailFn      func(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error)
	createFn        func(ctx context.Context, slot *models.OAuthConnectionSlot) (*models.OAuthConnectionSlot, error)
	updateFn        func(ctx context.Context, orgID, slotID uuid.UUID, data *models.UpdateOAuthConnectionSlot) error
	deleteFn        func(ctx context.Context, orgID, slotID uuid.UUID) error
	countAccountsFn func(ctx context.Context, slotID uuid.UUID) (int, error)
}

func (m *mockOAuthSlotRepo) List(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error) {
	if m.listFn != nil {
		return m.listFn(ctx, orgID)
	}
	return nil, nil
}
func (m *mockOAuthSlotRepo) GetByID(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, orgID, slotID)
	}
	return nil, nil
}
func (m *mockOAuthSlotRepo) GetRawByID(ctx context.Context, slotID uuid.UUID) (*models.OAuthConnectionSlot, error) {
	if m.getRawByIDFn != nil {
		return m.getRawByIDFn(ctx, slotID)
	}
	return nil, nil
}
func (m *mockOAuthSlotRepo) GetAvailableSlot(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error) {
	if m.getAvailFn != nil {
		return m.getAvailFn(ctx, orgID, provider)
	}
	return nil, nil
}
func (m *mockOAuthSlotRepo) Create(ctx context.Context, slot *models.OAuthConnectionSlot) (*models.OAuthConnectionSlot, error) {
	if m.createFn != nil {
		return m.createFn(ctx, slot)
	}
	return slot, nil
}
func (m *mockOAuthSlotRepo) Update(ctx context.Context, orgID, slotID uuid.UUID, data *models.UpdateOAuthConnectionSlot) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, orgID, slotID, data)
	}
	return nil
}
func (m *mockOAuthSlotRepo) Delete(ctx context.Context, orgID, slotID uuid.UUID) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, orgID, slotID)
	}
	return nil
}
func (m *mockOAuthSlotRepo) CountAccountsForSlot(ctx context.Context, slotID uuid.UUID) (int, error) {
	if m.countAccountsFn != nil {
		return m.countAccountsFn(ctx, slotID)
	}
	return 0, nil
}

type testEKStore struct {
	store map[uuid.UUID]string
}

func (s *testEKStore) Put(ctx context.Context, orgID uuid.UUID, dek string) error {
	if s.store == nil {
		s.store = make(map[uuid.UUID]string)
	}
	s.store[orgID] = dek
	return nil
}
func (s *testEKStore) Get(ctx context.Context, orgID uuid.UUID) (string, error) {
	if s.store == nil {
		return "", nil
	}
	return s.store[orgID], nil
}
func (s *testEKStore) Delete(ctx context.Context, orgID uuid.UUID) error {
	if s.store != nil {
		delete(s.store, orgID)
	}
	return nil
}
func (s *testEKStore) Name() string { return "test" }

func newTestCipherService(t *testing.T) cipher.CipherService {
	t.Helper()
	masterKey := []byte("01234567890123456789012345678901")
	k, err := kms.NewLocal(masterKey)
	if err != nil {
		t.Fatalf("new local kms: %v", err)
	}
	return cipher.NewService(k, nil, &testEKStore{store: make(map[uuid.UUID]string)})
}

func setupOAuthSlotsTestRouter(h *Handler, orgID *uuid.UUID) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if orgID != nil {
			c.Set(string(middleware.OrganizationIDKey), *orgID)
		}
		c.Next()
	})
	r.GET("/settings/oauth-slots", h.ListOAuthSlots)
	r.POST("/settings/oauth-slots", h.CreateOAuthSlot)
	r.PUT("/settings/oauth-slots/:id", h.UpdateOAuthSlot)
	r.DELETE("/settings/oauth-slots/:id", h.DeleteOAuthSlot)
	return r
}

func TestListOAuthSlots_NoOrg(t *testing.T) {
	h := &Handler{OAuthSlotRepository: &mockOAuthSlotRepo{}}
	r := setupOAuthSlotsTestRouter(h, nil)

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "GET", "/settings/oauth-slots", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestListOAuthSlots_Success(t *testing.T) {
	orgID := uuid.New()
	slotID := uuid.New()
	h := &Handler{
		OAuthSlotRepository: &mockOAuthSlotRepo{
			listFn: func(ctx context.Context, o uuid.UUID) ([]*models.OAuthConnectionSlot, error) {
				return []*models.OAuthConnectionSlot{
					{
						ID:             slotID,
						OrgID:          orgID,
						Provider:       "gmail",
						Name:           "Slot 1",
						ClientID:       "cid-1",
						MaxAccounts:    100,
						ConnectedCount: 42,
						CreatedAt:      time.Now(),
					},
				}, nil
			},
		},
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "GET", "/settings/oauth-slots", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var res struct {
		Data []*models.OAuthConnectionSlot `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("json parse: %v", err)
	}
	if len(res.Data) != 1 || res.Data[0].ConnectedCount != 42 {
		t.Fatalf("unexpected data: %+v", res.Data)
	}
}

func TestCreateOAuthSlot_ValidationErrors(t *testing.T) {
	orgID := uuid.New()
	h := &Handler{
		OAuthSlotRepository: &mockOAuthSlotRepo{},
		CipherService:       newTestCipherService(t),
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	cases := []struct {
		name    string
		payload map[string]any
	}{
		{"missing name", map[string]any{"client_id": "c", "client_secret": "s"}},
		{"missing client_id", map[string]any{"name": "n", "client_secret": "s"}},
		{"missing client_secret", map[string]any{"name": "n", "client_id": "c"}},
		{"invalid provider", map[string]any{"name": "n", "client_id": "c", "client_secret": "s", "provider": "yahoo"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(context.Background(), "POST", "/settings/oauth-slots", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected 400 for %s, got %d", tc.name, w.Code)
			}
		})
	}
}

func TestCreateOAuthSlot_Success(t *testing.T) {
	orgID := uuid.New()
	var savedSlot *models.OAuthConnectionSlot
	h := &Handler{
		CipherService: newTestCipherService(t),
		OAuthSlotRepository: &mockOAuthSlotRepo{
			createFn: func(ctx context.Context, slot *models.OAuthConnectionSlot) (*models.OAuthConnectionSlot, error) {
				savedSlot = slot
				slot.ID = uuid.New()
				return slot, nil
			},
		},
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	payload := map[string]any{
		"name":          "My Google Project",
		"provider":      "gmail",
		"client_id":     "client-123",
		"client_secret": "super-secret-key",
		"max_accounts":  100,
		"is_default":    true,
	}
	body, _ := json.Marshal(payload)
	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "POST", "/settings/oauth-slots", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if savedSlot == nil {
		t.Fatalf("expected slot to be passed to repo.Create")
	}
	if savedSlot.ClientID != "client-123" || savedSlot.Name != "My Google Project" {
		t.Fatalf("unexpected slot data: %+v", savedSlot)
	}
	// The secret must be encrypted (not plaintext)
	if savedSlot.EncryptedClientSecret == "super-secret-key" || savedSlot.EncryptedClientSecret == "" {
		t.Fatalf("expected client secret to be encrypted, got %q", savedSlot.EncryptedClientSecret)
	}
}

func TestUpdateOAuthSlot_Success(t *testing.T) {
	orgID := uuid.New()
	slotID := uuid.New()
	updated := false
	newName := "Updated Slot Name"
	newMax := 80
	h := &Handler{
		CipherService: newTestCipherService(t),
		OAuthSlotRepository: &mockOAuthSlotRepo{
			updateFn: func(ctx context.Context, o, s uuid.UUID, data *models.UpdateOAuthConnectionSlot) error {
				if o == orgID && s == slotID && *data.Name == newName && *data.MaxAccounts == newMax {
					updated = true
				}
				return nil
			},
			getByIDFn: func(ctx context.Context, o, s uuid.UUID) (*models.OAuthConnectionSlot, error) {
				return &models.OAuthConnectionSlot{
					ID:          slotID,
					OrgID:       orgID,
					Name:        newName,
					MaxAccounts: newMax,
				}, nil
			},
		},
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	payload := map[string]any{
		"name":         newName,
		"max_accounts": newMax,
	}
	body, _ := json.Marshal(payload)
	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "PUT", "/settings/oauth-slots/"+slotID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !updated {
		t.Fatalf("expected update to be called with modified fields")
	}
}

func TestDeleteOAuthSlot_BlockedByActiveAccounts(t *testing.T) {
	orgID := uuid.New()
	slotID := uuid.New()
	h := &Handler{
		OAuthSlotRepository: &mockOAuthSlotRepo{
			countAccountsFn: func(ctx context.Context, sID uuid.UUID) (int, error) {
				return 3, nil // 3 active accounts connected
			},
		},
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "DELETE", "/settings/oauth-slots/"+slotID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when active accounts exist, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteOAuthSlot_Success(t *testing.T) {
	orgID := uuid.New()
	slotID := uuid.New()
	deleted := false
	h := &Handler{
		OAuthSlotRepository: &mockOAuthSlotRepo{
			countAccountsFn: func(ctx context.Context, sID uuid.UUID) (int, error) {
				return 0, nil
			},
			deleteFn: func(ctx context.Context, o, s uuid.UUID) error {
				if o == orgID && s == slotID {
					deleted = true
				}
				return nil
			},
		},
	}
	r := setupOAuthSlotsTestRouter(h, &orgID)

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(context.Background(), "DELETE", "/settings/oauth-slots/"+slotID.String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !deleted {
		t.Fatalf("expected delete to be called")
	}
}
