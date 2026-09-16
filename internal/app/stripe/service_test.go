package stripe

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	stripeapi "github.com/stripe/stripe-go/v76"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

type billingSubRepo struct {
	repository.SubscriptionRepository
	sub       *models.Subscription
	lookupErr error
	updated   bool
	recorded  bool
}

func (r *billingSubRepo) GetByOrganizationID(context.Context, uuid.UUID) (*models.Subscription, error) {
	return r.sub, r.lookupErr
}
func (r *billingSubRepo) GetByStripeSubscriptionID(context.Context, string) (*models.Subscription, error) {
	return nil, r.lookupErr
}
func (r *billingSubRepo) Update(_ context.Context, sub *models.Subscription) error {
	r.sub, r.updated = sub, true
	return nil
}

type billingPlanRepo struct {
	repository.PlanRepository
	plan *models.Plan
}

func (r *billingPlanRepo) GetByID(context.Context, uuid.UUID) (*models.Plan, error) {
	return r.plan, nil
}
func (r *billingPlanRepo) GetByStripePriceID(context.Context, string) (*models.Plan, error) {
	return r.plan, nil
}

func TestSubscriptionCheckoutCustomerParameters(t *testing.T) {
	for _, customerID := range []string{"", "cus_existing"} {
		t.Run("customer_"+customerID, func(t *testing.T) {
			called := false
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				if err := r.ParseForm(); err != nil {
					t.Fatal(err)
				}
				if r.Form.Get("mode") != "subscription" || r.Form.Has("customer_creation") || r.Form.Get("customer") != customerID {
					t.Errorf("invalid checkout parameters: %v", r.Form)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"id":"cs_test","url":"https://checkout.stripe.com/test"}`))
			}))
			defer server.Close()
			old := stripeapi.GetBackend(stripeapi.APIBackend)
			stripeapi.SetBackend(stripeapi.APIBackend, stripeapi.GetBackendWithConfig(stripeapi.APIBackend, &stripeapi.BackendConfig{URL: stripeapi.String(server.URL), HTTPClient: server.Client()}))
			t.Cleanup(func() { stripeapi.SetBackend(stripeapi.APIBackend, old) })
			s := &stripeService{subRepo: &billingSubRepo{sub: &models.Subscription{StripeCustomerID: customerID}}}
			_, err := s.CreateCheckoutSession(context.Background(), uuid.New(), uuid.New(), "price_test", "https://example.com/success", "https://example.com/cancel", "")
			if err != nil || !called {
				t.Fatalf("checkout called=%v error=%v", called, err)
			}
		})
	}
}

func TestPortalRejectsMissingCustomer(t *testing.T) {
	for _, customerID := range []string{"", " \t"} {
		url, err := (&stripeService{}).CreatePortalSession(context.Background(), customerID, "https://example.com")
		if err == nil || err.Code != errx.BadRequest || url != "" {
			t.Fatalf("url=%q error=%v", url, err)
		}
	}
}

func TestSubscriptionEventBeforeCheckout(t *testing.T) {
	orgID, planID := uuid.New(), uuid.New()
	repo := &billingSubRepo{sub: &models.Subscription{OrganizationID: orgID}}
	s := &stripeService{subRepo: repo, planRepo: &billingPlanRepo{plan: &models.Plan{ID: planID}}}
	raw, err := json.Marshal(map[string]any{"id": "sub_new", "customer": "cus_new", "status": "active", "metadata": map[string]string{"org_id": orgID.String()}, "items": map[string]any{"data": []any{map[string]any{"price": map[string]string{"id": "price_new"}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if xerr := s.handleSubscriptionUpdated(context.Background(), &stripeapi.Event{Data: &stripeapi.EventData{Raw: raw}}); xerr != nil {
		t.Fatal(xerr)
	}
	if !repo.updated || repo.sub.PlanID != planID || repo.sub.StripeCustomerID != "cus_new" || repo.sub.StripeSubscriptionID == nil || *repo.sub.StripeSubscriptionID != "sub_new" || repo.sub.Status != models.SubscriptionStatusActive {
		t.Fatalf("subscription event did not activate the workspace: %+v", repo.sub)
	}
}

func TestSubscriptionLookupFailureRemainsRetryable(t *testing.T) {
	s := &stripeService{subRepo: &billingSubRepo{lookupErr: errors.New("database unavailable")}}
	err := s.handleSubscriptionUpdated(context.Background(), &stripeapi.Event{Data: &stripeapi.EventData{Raw: json.RawMessage(`{"id":"sub_new"}`)}})
	if err == nil || err.Code != errx.Internal {
		t.Fatalf("expected retryable failure, got %v", err)
	}
}

func TestAnnualChangeDoesNotFallBackToMonthly(t *testing.T) {
	s := &stripeService{subRepo: &billingSubRepo{sub: &models.Subscription{StripeSubscriptionID: stripeapi.String("sub_existing")}}, planRepo: &billingPlanRepo{plan: &models.Plan{StripePriceID: stripeapi.String("price_monthly")}}}
	_, err := s.ChangePlan(context.Background(), uuid.New(), uuid.New(), "", "", "year")
	if err == nil || err.Code != errx.BadRequest {
		t.Fatalf("expected unavailable annual price, got %v", err)
	}
}

type billingCredits struct {
	resetErr error
	granted  int
	reset    int
}

func (c *billingCredits) ResetMonthlyAllowance(_ context.Context, _ uuid.UUID, amount int, _ string) error {
	c.reset = amount
	return c.resetErr
}
func (c *billingCredits) GrantPurchased(_ context.Context, _ uuid.UUID, amount int, _, _ string) (int, error) {
	c.granted += amount
	return c.granted, nil
}
func (r *billingSubRepo) WebhookEventExists(context.Context, string) (bool, error) { return false, nil }
func (r *billingSubRepo) RecordWebhookEvent(context.Context, *models.StripeWebhookEvent) error {
	r.recorded = true
	return nil
}

func TestInvoiceBeforeCheckoutAndRetryAfterCreditFailure(t *testing.T) {
	orgID := uuid.New()
	repo := &billingSubRepo{sub: &models.Subscription{OrganizationID: orgID}}
	credits := &billingCredits{resetErr: errors.New("temporary ledger failure")}
	s := &stripeService{subRepo: repo, planRepo: &billingPlanRepo{plan: &models.Plan{MonthlyCredits: 500}}, credits: credits}
	raw := json.RawMessage(`{"subscription":"sub_new","billing_reason":"subscription_create","subscription_details":{"metadata":{"org_id":"` + orgID.String() + `"}},"lines":{"data":[{"price":{"id":"price_new"}}]}}`)
	event := &stripeapi.Event{ID: "evt_invoice", Type: "invoice.paid", Data: &stripeapi.EventData{Raw: raw}}
	if err := s.ProcessWebhookEvent(context.Background(), event); err == nil || err.Code != errx.Internal {
		t.Fatalf("expected retryable error, got %v", err)
	}
	if repo.recorded {
		t.Fatal("failed credit grant marked processed")
	}
	credits.resetErr = nil
	if err := s.ProcessWebhookEvent(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	if !repo.recorded || credits.reset != 500 {
		t.Fatal("retried invoice did not grant monthly allowance")
	}
}

func TestAsyncCreditPurchaseStoresCustomer(t *testing.T) {
	orgID := uuid.New()
	repo := &billingSubRepo{sub: &models.Subscription{OrganizationID: orgID}}
	credits := &billingCredits{}
	s := &stripeService{subRepo: repo, credits: credits}
	raw := json.RawMessage(`{"id":"cs_credit","customer":"cus_credit","payment_status":"paid","metadata":{"purpose":"credit_topup","credits":"500","org_id":"` + orgID.String() + `"}}`)
	event := &stripeapi.Event{ID: "evt_credit", Type: "checkout.session.async_payment_succeeded", Data: &stripeapi.EventData{Raw: raw}}
	if err := s.ProcessWebhookEvent(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	if !repo.updated || repo.sub.StripeCustomerID != "cus_credit" || credits.granted != 500 || !repo.recorded {
		t.Fatal("purchase did not persist the billing customer and credits")
	}
}
