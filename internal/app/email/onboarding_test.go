package email

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/app/cipher"
	"github.com/warmbly/warmbly/internal/config"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/kms"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
	"golang.org/x/oauth2"
)

// config.LoadOauth2Inbox always returns a non-nil config whose fields are empty
// when the variables are unset, so a nil check alone reports every provider as
// available and the flow fails later with an opaque error from the provider.
func TestOAuthConfigFor_UnconfiguredProviderIsReported(t *testing.T) {
	svc := &emailService{oauthInbox: &config.Oauth2Inbox{
		Google:  &oauth2.Config{},
		Outlook: &oauth2.Config{},
	}}

	for _, tc := range []struct {
		provider models.InboxProvider
		want     *errx.Error
	}{
		{models.InboxProviderGoogle, errx.ErrEmailOnboardGoogleNotConfigured},
		{models.InboxProviderOutlook, errx.ErrEmailOnboardOutlookNotConfigured},
	} {
		cfg, err := svc.oauthConfigFor(tc.provider)
		if cfg != nil {
			t.Errorf("%s: expected no config, got one", tc.provider)
		}
		if err != tc.want {
			t.Errorf("%s: expected %v, got %v", tc.provider, tc.want, err)
		}
		if err != nil && err.Identifier != "mailbox_provider_not_configured" {
			t.Errorf("%s: clients branch on this identifier, got %q", tc.provider, err.Identifier)
		}
	}
}

// A half-set credential is still unusable, and silently building an OAuth URL
// from it sends the user to a provider error page instead of telling them what
// to fix.
func TestOAuthConfigFor_PartialCredentialsAreNotConfigured(t *testing.T) {
	svc := &emailService{oauthInbox: &config.Oauth2Inbox{
		Google:  &oauth2.Config{ClientID: "id-without-secret"},
		Outlook: &oauth2.Config{ClientSecret: "secret-without-id"},
	}}

	if _, err := svc.oauthConfigFor(models.InboxProviderGoogle); err != errx.ErrEmailOnboardGoogleNotConfigured {
		t.Errorf("google with no secret should be unconfigured, got %v", err)
	}
	if _, err := svc.oauthConfigFor(models.InboxProviderOutlook); err != errx.ErrEmailOnboardOutlookNotConfigured {
		t.Errorf("outlook with no client id should be unconfigured, got %v", err)
	}
}

func TestOAuthConfigFor_ConfiguredProviderIsReturned(t *testing.T) {
	google := &oauth2.Config{ClientID: "id", ClientSecret: "secret"}
	svc := &emailService{oauthInbox: &config.Oauth2Inbox{
		Google:  google,
		Outlook: &oauth2.Config{},
	}}

	cfg, err := svc.oauthConfigFor(models.InboxProviderGoogle)
	if err != nil {
		t.Fatalf("configured google should be returned, got %v", err)
	}
	if cfg != google {
		t.Error("expected the configured google client")
	}

	// One provider being configured must not make the other appear available.
	if _, err := svc.oauthConfigFor(models.InboxProviderOutlook); err != errx.ErrEmailOnboardOutlookNotConfigured {
		t.Errorf("outlook should still be unconfigured, got %v", err)
	}
}

// The unencrypted mailbox mode has two gates and they answer different
// questions: whether this deployment can host a local relay at all, and
// whether the host given is that relay. A user who gets the wrong one back is
// sent to fix the wrong thing.
func TestValidateMailSecurity_CleartextIsLoopbackOnlyAndSelfHostOnly(t *testing.T) {
	svc := func(host, security string) *models.Service {
		return &models.Service{Host: host, Port: 1143, Security: security}
	}
	tls := svc("imap.example.com", models.MailSecurityTLS)

	for _, tc := range []struct {
		name       string
		deployment string
		smtp, imap *models.Service
		want       *errx.Error
	}{
		{"self-host, loopback imap", "self_hosted", svc("smtp.example.com", models.MailSecurityStartTLS), svc("127.0.0.1", models.MailSecurityNone), nil},
		{"self-host, localhost smtp", "self_hosted", svc("localhost", models.MailSecurityNone), tls, nil},
		{"self-host, ipv6 loopback", "self_hosted", svc("::1", models.MailSecurityNone), tls, nil},
		{"self-host, remote imap", "self_hosted", svc("smtp.example.com", models.MailSecurityTLS), svc("imap.proton.me", models.MailSecurityNone), errx.ErrEmailIMAPSecurityNotLocal},
		{"self-host, remote smtp", "self_hosted", svc("mail.example.com", models.MailSecurityNone), tls, errx.ErrEmailSMTPSecurityNotLocal},
		// Hosted: the worker is not the customer's machine, so a loopback
		// address there is the worker's own and the mode is refused outright.
		{"hosted, loopback smtp", "cloud", svc("127.0.0.1", models.MailSecurityNone), tls, errx.ErrEmailSMTPSecurityHosted},
		{"hosted, loopback imap", "cloud", svc("smtp.example.com", models.MailSecurityTLS), svc("localhost", models.MailSecurityNone), errx.ErrEmailIMAPSecurityHosted},
		{"unknown mode still rejected", "self_hosted", svc("localhost", "plain"), tls, errx.ErrEmailSMTPSecurity},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("DEPLOYMENT_MODE", tc.deployment)
			got := validateMailSecurity(tc.smtp, tc.imap)
			if got != tc.want {
				t.Fatalf("validateMailSecurity() = %v, want %v", got, tc.want)
			}
		})
	}
}

type stubSlotRepo struct {
	repository.OAuthSlotRepository
	getByIDFn  func(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error)
	getAvailFn func(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error)
	listFn     func(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error)
}

func (s *stubSlotRepo) GetByID(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error) {
	if s.getByIDFn != nil {
		return s.getByIDFn(ctx, orgID, slotID)
	}
	return nil, errors.New("not found")
}
func (s *stubSlotRepo) GetAvailableSlot(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error) {
	if s.getAvailFn != nil {
		return s.getAvailFn(ctx, orgID, provider)
	}
	return nil, errors.New("no available slot")
}
func (s *stubSlotRepo) List(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error) {
	if s.listFn != nil {
		return s.listFn(ctx, orgID)
	}
	return nil, nil
}

type stubEKStore struct {
	store map[uuid.UUID]string
}

func (s *stubEKStore) Put(ctx context.Context, orgID uuid.UUID, dek string) error {
	if s.store == nil {
		s.store = make(map[uuid.UUID]string)
	}
	s.store[orgID] = dek
	return nil
}
func (s *stubEKStore) Get(ctx context.Context, orgID uuid.UUID) (string, error) {
	if s.store == nil {
		return "", nil
	}
	return s.store[orgID], nil
}
func (s *stubEKStore) Delete(ctx context.Context, orgID uuid.UUID) error {
	if s.store != nil {
		delete(s.store, orgID)
	}
	return nil
}
func (s *stubEKStore) Name() string { return "stub" }

func TestOAuthConfigForSlot_CapacityAndRouting(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()
	slot1ID := uuid.New()
	slot2ID := uuid.New()

	masterKey := []byte("01234567890123456789012345678901")
	k, err := kms.NewLocal(masterKey)
	if err != nil {
		t.Fatalf("kms: %v", err)
	}
	cipherSvc := cipher.NewService(k, nil, &stubEKStore{store: make(map[uuid.UUID]string)})
	cph, err := cipherSvc.Cipher(ctx, orgID)
	if err != nil {
		t.Fatalf("cipher: %v", err)
	}

	encSecret1, err := cph.Encrypt(ctx, "secret-for-slot-1")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	encSecret2, err := cph.Encrypt(ctx, "secret-for-slot-2")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	slot1 := &models.OAuthConnectionSlot{
		ID:                    slot1ID,
		OrgID:                 orgID,
		Provider:              "gmail",
		Name:                  "Google Project 1",
		ClientID:              "client-id-1",
		EncryptedClientSecret: encSecret1,
		MaxAccounts:           100,
		ConnectedCount:        100, // Full!
	}
	slot2 := &models.OAuthConnectionSlot{
		ID:                    slot2ID,
		OrgID:                 orgID,
		Provider:              "gmail",
		Name:                  "Google Project 2",
		ClientID:              "client-id-2",
		EncryptedClientSecret: encSecret2,
		MaxAccounts:           100,
		ConnectedCount:        5, // 95 open slots
	}

	repo := &stubSlotRepo{
		getByIDFn: func(ctx context.Context, o, sID uuid.UUID) (*models.OAuthConnectionSlot, error) {
			if sID == slot1ID {
				return slot1, nil
			}
			if sID == slot2ID {
				return slot2, nil
			}
			return nil, errors.New("not found")
		},
		getAvailFn: func(ctx context.Context, o uuid.UUID, prov string) (*models.OAuthConnectionSlot, error) {
			// Auto-routing selects slot 2 because slot 1 is full
			return slot2, nil
		},
		listFn: func(ctx context.Context, o uuid.UUID) ([]*models.OAuthConnectionSlot, error) {
			return []*models.OAuthConnectionSlot{slot1, slot2}, nil
		},
	}

	svc := &emailService{
		oauthSlots:    repo,
		cipherService: cipherSvc,
		oauthInbox: &config.Oauth2Inbox{
			Google: &oauth2.Config{
				RedirectURL: "http://localhost:8080/addresses/google/callback",
				Scopes:      []string{"https://mail.google.com/"},
				Endpoint: oauth2.Endpoint{
					AuthURL:  "https://accounts.google.com/o/oauth2/auth",
					TokenURL: "https://oauth2.googleapis.com/token",
				},
			},
		},
	}

	// 1. Explicitly requesting full slot1 must be rejected
	cfg, chosen, xerr := svc.oauthConfigForSlot(ctx, &orgID, models.InboxProviderGoogle, &slot1ID)
	if xerr == nil {
		t.Fatalf("expected error when requesting full slot, got cfg: %+v, slot: %+v", cfg, chosen)
	}
	if xerr.Message != "חיבור ה-OAuth הגיע למכסה המרבית (100 תיבות). נא לבחור או להוסיף חיבור אחר." {
		t.Fatalf("unexpected error message: %s", xerr.Message)
	}

	// 2. Automatic routing (slotID == nil) picks slot2 and decrypts secret
	cfg2, chosen2, xerr2 := svc.oauthConfigForSlot(ctx, &orgID, models.InboxProviderGoogle, nil)
	if xerr2 != nil {
		t.Fatalf("auto-route to slot2 failed: %v", xerr2)
	}
	if chosen2.ID != slot2ID {
		t.Fatalf("expected slot2, got %v", chosen2.ID)
	}
	if cfg2.ClientID != "client-id-2" {
		t.Fatalf("expected client-id-2, got %q", cfg2.ClientID)
	}
	if cfg2.ClientSecret != "secret-for-slot-2" {
		t.Fatalf("expected decrypted secret 'secret-for-slot-2', got %q", cfg2.ClientSecret)
	}
	if cfg2.RedirectURL != "http://localhost:8080/addresses/google/callback" {
		t.Fatalf("unexpected redirect URL: %q", cfg2.RedirectURL)
	}

	// 3. When all slots are full, auto routing informs the user with actionable message
	repo.getAvailFn = func(ctx context.Context, o uuid.UUID, prov string) (*models.OAuthConnectionSlot, error) {
		return nil, errors.New("all full")
	}
	_, _, xerr3 := svc.oauthConfigForSlot(ctx, &orgID, models.InboxProviderGoogle, nil)
	if xerr3 == nil {
		t.Fatalf("expected error when all slots are full")
	}
	if xerr3.Message != "כל חיבורי ה-OAuth מלאים (הגיעו למגבלת 100 התיבות). נא להוסיף חיבור פרויקט גוגל חדש בהגדרות." {
		t.Fatalf("unexpected error message: %s", xerr3.Message)
	}
}
