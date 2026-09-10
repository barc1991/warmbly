package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/warmbly/warmbly/internal/app/updates"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/version"
)

// The update surface behind the admin panel's top bar: what is running, what
// is newest, and the one button that applies it through the host-side updater.
//
//   GET  /admin/instance/update        state; ?log=1 keeps the job log
//   POST /admin/instance/update/check  refresh GitHub and the updater now
//   POST /admin/instance/update/apply  start an update job

// AdminUpdateState returns the cached release check plus a live read of the
// updater. Cheap enough for the top bar to poll.
func (h *Handler) AdminUpdateState(c *gin.Context) {
	if h.UpdatesService == nil {
		c.JSON(http.StatusOK, updates.State{Running: version.Current(), Updater: updates.UpdaterView{Status: "off"}})
		return
	}
	withLog := c.Query("log") == "1"
	c.JSON(http.StatusOK, h.UpdatesService.State(c.Request.Context(), withLog))
}

// AdminUpdateCheck re-runs both checks immediately.
func (h *Handler) AdminUpdateCheck(c *gin.Context) {
	if h.UpdatesService == nil {
		errx.JSON(c, errx.New(errx.BadRequest, "Update checks are not available on this deployment."))
		return
	}
	h.audit(c, models.AuditActionCheckReleases, models.AuditEntityInstance, nil, nil)
	c.JSON(http.StatusOK, h.UpdatesService.Check(c.Request.Context()))
}

// AdminUpdateApply starts an update job on the updater and returns it. The
// backend restarts as part of the job, so the caller polls the state endpoint
// until it answers again with a new version.
func (h *Handler) AdminUpdateApply(c *gin.Context) {
	errx.JSON(c, errx.New(errx.Forbidden, "Automatic updates via the UI are disabled on this instance to protect local customizations (Hebrew & RTL fork). Please update manually on the host."))
}
