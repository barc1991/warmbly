package handler

import (
	"bufio"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/app/geminikeys"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// ListGeminiKeys — GET /ai/gemini-keys
func (h *Handler) ListGeminiKeys(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	keys, xerr := h.GeminiKeysService.ListKeys(c.Request.Context(), *orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	if keys == nil {
		keys = []*models.OrgGeminiKey{}
	}
	c.JSON(http.StatusOK, keys)
}

type createGeminiKeysRequest struct {
	Name     string                      `json:"name"`
	Key      string                      `json:"key"`
	Keys     []geminikeys.CreateKeyInput `json:"keys"`
	KeysText string                      `json:"keys_text"`
}

// CreateGeminiKeys — POST /ai/gemini-keys
func (h *Handler) CreateGeminiKeys(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	var req createGeminiKeysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	var inputs []geminikeys.CreateKeyInput

	// Single key
	if strings.TrimSpace(req.Key) != "" {
		inputs = append(inputs, geminikeys.CreateKeyInput{
			Name: req.Name,
			Key:  req.Key,
		})
	}

	// Bulk array
	for _, k := range req.Keys {
		if strings.TrimSpace(k.Key) != "" {
			inputs = append(inputs, k)
		}
	}

	// Bulk multiline text
	if strings.TrimSpace(req.KeysText) != "" {
		scanner := bufio.NewScanner(strings.NewReader(req.KeysText))
		idx := 1
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.Fields(line)
			if len(parts) == 1 {
				inputs = append(inputs, geminikeys.CreateKeyInput{
					Key: line,
				})
			} else if len(parts) >= 2 {
				// Format: "Name AIzaSy..."
				inputs = append(inputs, geminikeys.CreateKeyInput{
					Name: parts[0],
					Key:  parts[1],
				})
			}
			idx++
		}
	}

	if len(inputs) == 0 {
		errx.JSON(c, errx.New(errx.BadRequest, "no API keys provided"))
		return
	}

	created, xerr := h.GeminiKeysService.CreateKeys(c.Request.Context(), *orgID, inputs)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusCreated, created)
}

// DeleteGeminiKey — DELETE /ai/gemini-keys/:id
func (h *Handler) DeleteGeminiKey(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key id"))
		return
	}

	if xerr := h.GeminiKeysService.DeleteKey(c.Request.Context(), *orgID, keyID); xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "key deleted"})
}

// UpdateGeminiKeyStatus — PATCH /ai/gemini-keys/:id/status
func (h *Handler) UpdateGeminiKeyStatus(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key id"))
		return
	}

	var req struct {
		Status models.GeminiKeyStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	if xerr := h.GeminiKeysService.UpdateKeyStatus(c.Request.Context(), *orgID, keyID, req.Status); xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

// TestGeminiKey — POST /ai/gemini-keys/:id/test
func (h *Handler) TestGeminiKey(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key id"))
		return
	}

	result, xerr := h.GeminiKeysService.TestKey(c.Request.Context(), *orgID, keyID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetGeminiConfig — GET /ai/gemini-config
func (h *Handler) GetGeminiConfig(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	cfg, stats, xerr := h.GeminiKeysService.GetConfig(c.Request.Context(), *orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"config": cfg,
		"stats":  stats,
	})
}

// UpdateGeminiConfig — PUT /ai/gemini-config
func (h *Handler) UpdateGeminiConfig(c *gin.Context) {
	if h.GeminiKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Gemini key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	var cfg models.GeminiOrgConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	if xerr := h.GeminiKeysService.UpdateConfig(c.Request.Context(), *orgID, &cfg); xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "config updated"})
}
