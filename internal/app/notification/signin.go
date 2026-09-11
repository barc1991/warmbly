package notification

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
)

// SignInAlerter adapts the notification service to the token service's
// new-device hook: a new sign-in becomes a security notification (in-app +
// email when the user has those channels on). Satisfies token.SignInAlerter.
type SignInAlerter struct {
	svc Service
}

// NewSignInAlerter wraps a notification service for the token package.
func NewSignInAlerter(svc Service) *SignInAlerter { return &SignInAlerter{svc: svc} }

// NewSignIn raises a "new device" security notification for the user.
func (a *SignInAlerter) NewSignIn(ctx context.Context, userID uuid.UUID, browser, os, city, country string) {
	if a == nil || a.svc == nil {
		return
	}
	device := strings.TrimSpace(browser + " on " + os)
	if device == "on" {
		device = "מכשיר לא מזוהה"
	}
	loc := strings.Trim(strings.TrimSpace(city+", "+country), ", ")
	body := "התחברות זוהתה מ-" + device
	if loc != "" {
		body += " (" + loc + ")"
	}
	body += ". אם זה לא היית אתה, מומלץ לשנות את הסיסמה שלך ולנתק הפעלות אחרות."
	a.svc.Notify(ctx, userID, nil, models.NotifSecuritySignIn,
		"התחברות חדשה לחשבונך", body, "/app/settings/security", nil)
}
