package models

import (
	"time"

	"github.com/google/uuid"
)

// EmailImage is one image in a workspace's library for email bodies. The bytes
// live in object storage under a public key (URL), because the recipient's mail
// client fetches them with no session of ours; the row is what the composer
// lists and what the storage quota counts.
type EmailImage struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty"`
	Filename       string     `json:"filename"`
	MimeType       string     `json:"mime_type"`
	Size           int64      `json:"size"`
	Width          int        `json:"width"`
	Height         int        `json:"height"`
	StorageKey     string     `json:"-"`
	URL            string     `json:"url"`
	CreatedAt      time.Time  `json:"created_at"`
}

// EmailImageKeyPrefix is the public object-key prefix email-body images live
// under. Public because a mail client loads them unauthenticated; the prefix is
// what /public/*key and the org-archive blob collector both match on.
const EmailImageKeyPrefix = "email-images/"

// EmailImageObjectKey is where an email-body image's bytes live. The nonce
// keeps two uploads of the same filename from sharing an immutably cached URL.
func EmailImageObjectKey(orgID uuid.UUID, filename string) string {
	return EmailImageKeyPrefix + orgID.String() + "/" + uuid.NewString() + "-" + filename
}
