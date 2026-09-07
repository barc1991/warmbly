package models

import (
	"net/url"
	"strings"

	"github.com/google/uuid"
)

// acquisitionFieldMax bounds every captured value. These arrive from a query
// string a stranger controls, so they are clamped before they reach the
// database rather than trusted because a form was involved.
const acquisitionFieldMax = 255

// OrgAcquisition is where a workspace came from, recorded once at signup and
// never updated. It is first-party on purpose: the analytics provider answers
// "which page converts" for a day, this answers "which channel pays" for as
// long as the account exists.
type OrgAcquisition struct {
	OrganizationID uuid.UUID `json:"organization_id"`
	LandingPath    string    `json:"landing_path,omitempty"`
	ReferrerHost   string    `json:"referrer_host,omitempty"`
	UTMSource      string    `json:"utm_source,omitempty"`
	UTMMedium      string    `json:"utm_medium,omitempty"`
	UTMCampaign    string    `json:"utm_campaign,omitempty"`
	UTMTerm        string    `json:"utm_term,omitempty"`
	UTMContent     string    `json:"utm_content,omitempty"`
}

// Empty reports whether the signup carried no attribution at all, which is the
// normal case for someone who typed the dashboard's address. Nothing is stored
// for an empty record.
func (a OrgAcquisition) Empty() bool {
	return a.LandingPath == "" && a.ReferrerHost == "" &&
		a.UTMSource == "" && a.UTMMedium == "" && a.UTMCampaign == "" &&
		a.UTMTerm == "" && a.UTMContent == ""
}

// Normalize clamps every field to what is safe to store: the landing path is
// reduced to a path (so a full URL, with whatever query string it carried,
// cannot smuggle anything in), the referrer to a bare host, and everything is
// trimmed and truncated.
func (a OrgAcquisition) Normalize() OrgAcquisition {
	return OrgAcquisition{
		OrganizationID: a.OrganizationID,
		LandingPath:    clampField(normalizePath(a.LandingPath)),
		ReferrerHost:   clampField(normalizeHost(a.ReferrerHost)),
		UTMSource:      clampField(a.UTMSource),
		UTMMedium:      clampField(a.UTMMedium),
		UTMCampaign:    clampField(a.UTMCampaign),
		UTMTerm:        clampField(a.UTMTerm),
		UTMContent:     clampField(a.UTMContent),
	}
}

func clampField(v string) string {
	v = strings.TrimSpace(v)
	if len(v) > acquisitionFieldMax {
		v = v[:acquisitionFieldMax]
	}
	// A control character in a value that ends up in a CSV export or a log line
	// is never wanted, and no legitimate UTM value has one.
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, v)
}

// normalizePath keeps the path and drops everything else, so "/pricing" and
// "https://warmbly.com/pricing?utm_source=x" both record "/pricing".
//
// The result must be absolute. url.Parse accepts a bare word as a relative
// path, so the check is on what comes out, not on what went in.
func normalizePath(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	if u, err := url.Parse(v); err == nil && strings.HasPrefix(u.Path, "/") {
		return u.Path
	}
	return ""
}

// normalizeHost keeps a bare hostname: no scheme, no path, no port, lowercase.
// A full referrer URL would carry the referring page's own query string, which
// is somebody else's data and not ours to store.
func normalizeHost(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	if u, err := url.Parse(v); err == nil && u.Hostname() != "" {
		return strings.ToLower(u.Hostname())
	}
	// Bare host, possibly with a path or port glued on.
	v = strings.TrimPrefix(strings.TrimPrefix(v, "https://"), "http://")
	v, _, _ = strings.Cut(v, "/")
	if host, _, ok := strings.Cut(v, ":"); ok {
		v = host
	}
	if strings.ContainsAny(v, " \t") {
		return ""
	}
	return strings.ToLower(v)
}
