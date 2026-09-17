package config

import (
	"os"
	"strconv"
	"strings"
)

// Automatic inbox tagging is OPTIONAL and off by default.
//
// It is the only feature in Warmbly that sends message content to a third
// party, so it is opt-in twice over: an operator has to supply a key AND turn
// the feature on. An instance that sets neither behaves exactly as it did
// before, with no code path reaching the network and no dependency on an
// external service being up.
//
// TYPESAFE_API_KEY       the key. No key means the feature cannot run.
// INBOX_TAGGING_ENABLED  the switch. Default false even when a key is present,
//
//	so a key configured for a staging trial does not
//	silently start classifying production mail.
func TypeSafeAPIKey() string {
	return strings.TrimSpace(os.Getenv("TYPESAFE_API_KEY"))
}

// InboxTaggingEnabled reports whether the feature should run. Both halves are
// required, and the key check is here rather than at the call site so there is
// one answer to "is this on" for the API, the consumer and the dashboard.
func InboxTaggingEnabled() bool {
	if TypeSafeAPIKey() == "" {
		return false
	}
	v, err := strconv.ParseBool(strings.TrimSpace(os.Getenv("INBOX_TAGGING_ENABLED")))
	return err == nil && v
}
