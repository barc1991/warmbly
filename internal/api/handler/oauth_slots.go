package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// ListOAuthSlots — GET /settings/oauth-slots
func (h *Handler) ListOAuthSlots(c *gin.Context) {
	if h.OAuthSlotRepository == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "OAuth slot management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	slots, err := h.OAuthSlotRepository.List(c.Request.Context(), *orgID)
	if err != nil {
		errx.JSON(c, errx.InternalError())
		return
	}
	if slots == nil {
		slots = []*models.OAuthConnectionSlot{}
	}
	c.JSON(http.StatusOK, gin.H{"data": slots})
}

// CreateOAuthSlot — POST /settings/oauth-slots
func (h *Handler) CreateOAuthSlot(c *gin.Context) {
	if h.OAuthSlotRepository == nil || h.CipherService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "OAuth slot management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	var req models.NewOAuthConnectionSlot
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "נתוני הבקשה אינם תקינים"))
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		errx.JSON(c, errx.New(errx.BadRequest, "יש להזין שם עבור החיבור"))
		return
	}
	clientID := strings.TrimSpace(req.ClientID)
	if clientID == "" {
		errx.JSON(c, errx.New(errx.BadRequest, "יש להזין Client ID"))
		return
	}
	clientSecret := strings.TrimSpace(req.ClientSecret)
	if clientSecret == "" {
		errx.JSON(c, errx.New(errx.BadRequest, "יש להזין Client Secret"))
		return
	}

	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "" {
		provider = "gmail"
	}
	if provider != "gmail" && provider != "outlook" {
		errx.JSON(c, errx.New(errx.BadRequest, "ספק אינו נתמך (יש לבחור gmail או outlook)"))
		return
	}

	maxAccounts := req.MaxAccounts
	if maxAccounts <= 0 {
		maxAccounts = 100
	}

	// Encrypt the client secret using the organization's DEK
	cph, cerr := h.CipherService.Cipher(c.Request.Context(), *orgID)
	if cerr != nil {
		errx.JSON(c, errx.InternalError())
		return
	}
	encSecret, err := cph.Encrypt(c.Request.Context(), clientSecret)
	if err != nil {
		errx.JSON(c, errx.InternalError())
		return
	}

	slot := &models.OAuthConnectionSlot{
		OrgID:                 *orgID,
		Provider:              provider,
		Name:                  name,
		ClientID:              clientID,
		EncryptedClientSecret: encSecret,
		MaxAccounts:           maxAccounts,
		IsDefault:             req.IsDefault,
	}

	created, err := h.OAuthSlotRepository.Create(c.Request.Context(), slot)
	if err != nil {
		if strings.Contains(err.Error(), "uq_oauth_connection_slots_org_client_id") {
			errx.JSON(c, errx.New(errx.BadRequest, "Client ID זה כבר מוגדר בארגון שלך"))
			return
		}
		errx.JSON(c, errx.InternalError())
		return
	}

	c.JSON(http.StatusCreated, created)
}

// UpdateOAuthSlot — PUT /settings/oauth-slots/:id
func (h *Handler) UpdateOAuthSlot(c *gin.Context) {
	if h.OAuthSlotRepository == nil || h.CipherService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "OAuth slot management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	slotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "מזהה סלוט לא תקין"))
		return
	}

	var req models.UpdateOAuthConnectionSlot
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "נתוני הבקשה אינם תקינים"))
		return
	}

	// If secret is updated, encrypt it
	if req.ClientSecret != nil && strings.TrimSpace(*req.ClientSecret) != "" {
		cph, cerr := h.CipherService.Cipher(c.Request.Context(), *orgID)
		if cerr != nil {
			errx.JSON(c, errx.InternalError())
			return
		}
		enc, err := cph.Encrypt(c.Request.Context(), strings.TrimSpace(*req.ClientSecret))
		if err != nil {
			errx.JSON(c, errx.InternalError())
			return
		}
		req.ClientSecret = &enc
	}

	if err := h.OAuthSlotRepository.Update(c.Request.Context(), *orgID, slotID, &req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, err.Error()))
		return
	}

	updated, err := h.OAuthSlotRepository.GetByID(c.Request.Context(), *orgID, slotID)
	if err != nil {
		errx.JSON(c, errx.InternalError())
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteOAuthSlot — DELETE /settings/oauth-slots/:id
func (h *Handler) DeleteOAuthSlot(c *gin.Context) {
	if h.OAuthSlotRepository == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "OAuth slot management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	slotID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "מזהה סלוט לא תקין"))
		return
	}

	count, _ := h.OAuthSlotRepository.CountAccountsForSlot(c.Request.Context(), slotID)
	if count > 0 {
		errx.JSON(c, errx.New(errx.BadRequest, "לא ניתן למחוק סלוט שמחוברות אליו תיבות דואר פעילות. יש לנתק או להעביר את התיבות תחילה."))
		return
	}

	if err := h.OAuthSlotRepository.Delete(c.Request.Context(), *orgID, slotID); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
