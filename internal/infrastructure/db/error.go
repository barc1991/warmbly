package db

import (
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/warmbly/warmbly/internal/observability/errs"
)

func CaptureError(err error, query string, params []any, operation string) {
	if err == nil {
		return
	}
	wrappedErr := fmt.Errorf("%s failed: %w (query: %s, params: %v)", operation, err, query, params)

	opts := []errs.Option{
		errs.Tag("db.operation", operation),
		errs.Tag("db.query", query),     // Sanitize sensitive params in prod
		errs.Extra("db.params", params), // Redact if sensitive
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		opts = append(opts,
			errs.Extra("pg.code", pgErr.Code), // e.g., "23505" for unique violation
			errs.Extra("pg.detail", pgErr.Detail),
			errs.Extra("pg.hint", pgErr.Hint),
		)
	}

	errs.CaptureException(wrappedErr, opts...)
}
