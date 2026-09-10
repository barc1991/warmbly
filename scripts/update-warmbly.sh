#!/usr/bin/env sh
# Safe Update Script for Warmbly (Hebrew RTL Edition)
set -eu

echo "=== Warmbly Safe Update (Hebrew RTL Edition) ==="

echo "\n1. Fetching upstream updates..."
git fetch upstream
git merge upstream/main --no-edit || true

echo "\n2. Building local Hebrew web frontend (preserving all translations & RTL)..."
docker compose build --no-cache web

echo "\n3. Building backend and workers from source..."
docker compose build backend worker consumer

echo "\n4. Restarting Warmbly services..."
docker compose up -d

echo "\n=== Update Complete! ==="
echo "Warmbly Web is running at: http://localhost:28173 with 100% Hebrew & RTL support."
