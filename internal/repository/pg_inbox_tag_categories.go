package repository

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TagCategoryStore resolves a tag slug to the workspace category row it files
// under. set_thread_labels takes category UUIDs, not strings, so every label
// needs a row before it can ever be applied.
//
// Cached per process: the taxonomy is a fixed list, so this resolves once per
// workspace per boot rather than once per message.
type TagCategoryStore struct {
	db    *pgxpool.Pool
	mu    sync.RWMutex
	cache map[string]uuid.UUID // orgID + "/" + slug -> category id
}

func NewTagCategoryStore(db *pgxpool.Pool) *TagCategoryStore {
	return &TagCategoryStore{db: db, cache: map[string]uuid.UUID{}}
}

// tagColors gives each family a colour so the labels read as a set in the
// inbox rather than a pile of identical chips. Anything unlisted gets slate.
var tagColors = map[string]string{
	"bounce-hard":           "#b91c1c",
	"bounce-soft":           "#c2410c",
	"auto-reply-ooo":        "#a16207",
	"auto-reply-ticket":     "#a16207",
	"human-reply":           "#0284c7",
	"cold-inbound":          "#7c3aed",
	"notification":          "#64748b",
	"internal":              "#475569",
	"agreed":                "#15803d",
	"wants-info":            "#0284c7",
	"wants-pricing":         "#0d9488",
	"not-now":               "#a16207",
	"not-interested":        "#9f1239",
	"wrong-person":          "#7c3aed",
	"opt-out":               "#b91c1c",
	"unclear":               "#64748b",
	"needs-review":          "#c2410c",
	"requests-removal":      "#b91c1c",
	"legal-threat":          "#b91c1c",
	"asks-for-call":         "#15803d",
	"needs-human-judgement": "#a16207",
}

const defaultTagColor = "#64748b"

// EnsureCategory returns the category id for a slug, creating the row the first
// time the label is used.
//
// Matched on title, case-insensitively, so a category a person already created
// by hand is adopted rather than duplicated: a workspace that already has an
// "agreed" label keeps using it.
func (s *TagCategoryStore) EnsureCategory(ctx context.Context, orgID uuid.UUID, slug string) (uuid.UUID, error) {
	key := orgID.String() + "/" + slug

	s.mu.RLock()
	if id, ok := s.cache[key]; ok {
		s.mu.RUnlock()
		return id, nil
	}
	s.mu.RUnlock()

	var id uuid.UUID
	err := s.db.QueryRow(ctx,
		`SELECT id FROM categories WHERE organization_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
		orgID, slug).Scan(&id)

	if err != nil {
		color := tagColors[slug]
		if color == "" {
			color = defaultTagColor
		}
		// position: after everything the workspace already has, so automatic
		// labels never reorder the ones a person arranged.
		if err := s.db.QueryRow(ctx, `
			INSERT INTO categories (organization_id, title, color, position)
			VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM categories WHERE organization_id = $1), 0))
			ON CONFLICT DO NOTHING
			RETURNING id`, orgID, slug, color).Scan(&id); err != nil {
			// A concurrent insert won the race; read back what it created.
			if rerr := s.db.QueryRow(ctx,
				`SELECT id FROM categories WHERE organization_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
				orgID, slug).Scan(&id); rerr != nil {
				return uuid.Nil, rerr
			}
		}
	}

	s.mu.Lock()
	s.cache[key] = id
	s.mu.Unlock()
	return id, nil
}

// EnsureAll creates every label in the taxonomy for a workspace, so the full
// set is visible in the inbox scope rail and selectable in the label filter
// from the moment the feature is switched on.
//
// Without this the labels appear one at a time, as each first fires. A
// workspace could not filter for "opt-out" until something had already opted
// out, which reads as the filter being broken rather than the inbox being
// quiet. Idempotent, so it is safe to call on every boot.
func (s *TagCategoryStore) EnsureAll(ctx context.Context, orgID uuid.UUID, slugs []string) error {
	for _, slug := range slugs {
		if _, err := s.EnsureCategory(ctx, orgID, slug); err != nil {
			return err
		}
	}
	return nil
}

// AddThreadLabels attaches labels without removing any, mirroring the unibox
// repository's own additive path.
//
// Additive is the whole point: a person who labelled a thread "important" must
// not lose it because the classifier ran again. Only the workspace's own
// categories are attached (the SELECT is the guard), and the applier is left
// NULL because there is no human behind an automatic label.
func (s *TagCategoryStore) AddThreadLabels(ctx context.Context, orgID uuid.UUID, threadID string, categoryIDs []uuid.UUID) error {
	if threadID == "" || len(categoryIDs) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO unibox_thread_labels (organization_id, thread_id, category_id)
		SELECT $1, $2, c.id
		FROM categories c
		WHERE c.organization_id = $1 AND c.id = ANY($3)
		ON CONFLICT (organization_id, thread_id, category_id) DO NOTHING
	`, orgID, threadID, categoryIDs)
	return err
}
