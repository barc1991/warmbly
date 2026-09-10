#!/usr/bin/env sh
# Safe Update Script for Warmbly (Hebrew RTL Edition)
# Preserves all Hebrew translations and RTL layout customizations.
set -eu

echo "=== Warmbly Safe Update ==="

# 1. Pull latest images for backend, workers, and infrastructure
echo "1. Pulling latest backend, worker, and infra images..."
docker compose pull backend worker consumer realtime tracking forms admin postgres redis nats

# 2. Build local Hebrew web frontend
echo "2. Building local Hebrew web frontend (preserving all translations)..."
docker compose build web

# 3. Bring up all containers
echo "3. Starting Warmbly services..."
docker compose up -d

echo "=== Update Complete! ==="
echo "Warmbly Web is running with full Hebrew & RTL support."
