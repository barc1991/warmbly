package advanced

import (
	"strings"
	"testing"

	"github.com/warmbly/warmbly/internal/models"
)

// The workspace default: a reply line, no link anywhere.
func replyLineSettings() models.UnsubscribeSettings {
	return models.DefaultAdvancedOutreachSettings().Unsubscribe
}

func TestPlainTextOptOutPassesWithTheReplyLine(t *testing.T) {
	c := &models.Campaign{TextOnly: true, UnsubscribeMode: "inherit"}
	got := plainTextOptOutResult(c, replyLineSettings(), []models.Sequence{
		emailStep(0, "Quick question", "Hi there, worth a chat?"),
	})
	if !got.Passed {
		t.Fatalf("reply-line opt-out should pass on a plain-text campaign: %+v", got)
	}
}

func TestPlainTextOptOutWarnsOnLinkMode(t *testing.T) {
	c := &models.Campaign{TextOnly: true, UnsubscribeMode: "link"}
	got := plainTextOptOutResult(c, replyLineSettings(), nil)
	if got.Passed || got.Severity != "warning" {
		t.Fatalf("link mode on a plain-text campaign should warn: %+v", got)
	}
	if !strings.Contains(got.Message, "opt-out line is set to Unsubscribe link") || got.Remediation == "" {
		t.Fatalf("warning should name the cause and a way out: %+v", got)
	}
}

func TestPlainTextOptOutWarnsOnAHandPlacedVariable(t *testing.T) {
	c := &models.Campaign{TextOnly: true, UnsubscribeMode: "inherit"}
	seqs := []models.Sequence{
		emailStep(0, "Quick question", "Hi there"),
		{Kind: "wait", Position: 1},
		emailStep(2, "Following up", "Not for you? "+models.UnsubscribeLinkToken),
	}
	got := plainTextOptOutResult(c, replyLineSettings(), seqs)
	if got.Passed {
		t.Fatalf("a hand-placed variable on a plain-text campaign should warn: %+v", got)
	}
	// Unnamed steps fall back to their place in builder order, not `position`,
	// which is 0-based on some campaigns and 1-based on others.
	if !strings.Contains(got.Message, "step 3 places the unsubscribe link variable") {
		t.Fatalf("warning should name the step: %s", got.Message)
	}

	named := []models.Sequence{{Kind: "email", Name: "Follow-up", BodyPlain: models.UnsubscribeLinkToken}}
	if got := plainTextOptOutResult(c, replyLineSettings(), named); !strings.Contains(got.Message, `the step "Follow-up" places`) {
		t.Fatalf("a named step should be named: %s", got.Message)
	}
}

func TestPlainTextOptOutIgnoresNonEmailStepsAndOtherCopy(t *testing.T) {
	c := &models.Campaign{TextOnly: true, UnsubscribeMode: "inherit"}
	seqs := []models.Sequence{
		{Kind: "action", Position: 0, BodyPlain: models.UnsubscribeLinkToken},
		emailStep(1, "Quick question", "Reply and I'll stop emailing."),
	}
	if got := plainTextOptOutResult(c, replyLineSettings(), seqs); !got.Passed {
		t.Fatalf("a non-email node's config must not be read as copy: %+v", got)
	}
}

func TestPlainTextOptOutCampaignModeOverridesTheWorkspaceLink(t *testing.T) {
	// Workspace is on link mode, this campaign opted back to the reply line.
	workspace := models.UnsubscribeSettings{Mode: models.UnsubscribeModeLink}
	c := &models.Campaign{TextOnly: true, UnsubscribeMode: "text"}
	if got := plainTextOptOutResult(c, workspace, nil); !got.Passed {
		t.Fatalf("campaign override to the reply line should pass: %+v", got)
	}
}
