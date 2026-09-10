package handler

import (
	"bufio"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/api/middleware"
	"github.com/warmbly/warmbly/internal/app/serperkeys"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// ListSerperKeys — GET /ai/serper-keys
func (h *Handler) ListSerperKeys(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	keys, xerr := h.SerperKeysService.ListKeys(c.Request.Context(), *orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}
	c.JSON(http.StatusOK, keys)
}

type createSerperKeysRequest struct {
	Name     string                      `json:"name"`
	Key      string                      `json:"key"`
	Keys     []serperkeys.CreateKeyInput `json:"keys"`
	KeysText string                      `json:"keys_text"`
}

// CreateSerperKeys — POST /ai/serper-keys
func (h *Handler) CreateSerperKeys(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	var req createSerperKeysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	var inputs []serperkeys.CreateKeyInput

	if strings.TrimSpace(req.Key) != "" {
		inputs = append(inputs, serperkeys.CreateKeyInput{
			Name: req.Name,
			Key:  req.Key,
		})
	}

	for _, k := range req.Keys {
		if strings.TrimSpace(k.Key) != "" {
			inputs = append(inputs, k)
		}
	}

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
				inputs = append(inputs, serperkeys.CreateKeyInput{
					Key: line,
				})
			} else if len(parts) >= 2 {
				inputs = append(inputs, serperkeys.CreateKeyInput{
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

	created, xerr := h.SerperKeysService.CreateKeys(c.Request.Context(), *orgID, inputs)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusCreated, created)
}

// DeleteSerperKey — DELETE /ai/serper-keys/:id
func (h *Handler) DeleteSerperKey(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	idStr := c.Param("id")
	keyID, err := uuid.Parse(idStr)
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key ID"))
		return
	}

	if xerr := h.SerperKeysService.DeleteKey(c.Request.Context(), *orgID, keyID); xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

type updateSerperKeyStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// UpdateSerperKeyStatus — PATCH /ai/serper-keys/:id/status
func (h *Handler) UpdateSerperKeyStatus(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	idStr := c.Param("id")
	keyID, err := uuid.Parse(idStr)
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key ID"))
		return
	}

	var req updateSerperKeyStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid status"))
		return
	}

	status := models.SerperKeyStatus(req.Status)
	if xerr := h.SerperKeysService.UpdateKeyStatus(c.Request.Context(), *orgID, keyID, status); xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": status})
}

// TestSerperKey — POST /ai/serper-keys/:id/test
func (h *Handler) TestSerperKey(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	idStr := c.Param("id")
	keyID, err := uuid.Parse(idStr)
	if err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid key ID"))
		return
	}

	res, xerr := h.SerperKeysService.TestKey(c.Request.Context(), *orgID, keyID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, res)
}

// GetSerperStats — GET /ai/serper-stats
func (h *Handler) GetSerperStats(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	stats, xerr := h.SerperKeysService.GetStats(c.Request.Context(), *orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetBDRSettings — GET /ai/bdr-settings
func (h *Handler) GetBDRSettings(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	st, xerr := h.SerperKeysService.GetBDRSettings(c.Request.Context(), *orgID)
	if xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, st)
}

// UpdateBDRSettings — PATCH /ai/bdr-settings
func (h *Handler) UpdateBDRSettings(c *gin.Context) {
	if h.SerperKeysService == nil {
		errx.JSON(c, errx.New(errx.ServiceUnavailable, "Serper key management is not configured"))
		return
	}
	orgID := middleware.GetOrganizationID(c)
	if orgID == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "no organization selected"))
		return
	}

	var st models.BDRSettings
	if err := c.ShouldBindJSON(&st); err != nil {
		errx.JSON(c, errx.New(errx.BadRequest, "invalid request body"))
		return
	}

	if xerr := h.SerperKeysService.UpdateBDRSettings(c.Request.Context(), *orgID, &st); xerr != nil {
		errx.JSON(c, xerr)
		return
	}

	c.JSON(http.StatusOK, st)
}
