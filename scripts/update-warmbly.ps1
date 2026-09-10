# Safe Update Script for Warmbly (Hebrew RTL Edition)
# Preserves all Hebrew translations and RTL layout customizations.

Write-Host "=== Warmbly Safe Update ===" -ForegroundColor Cyan

# 1. Pull latest images for backend, workers, and infrastructure
Write-Host "`n1. Pulling latest backend, worker, and infra images..." -ForegroundColor Yellow
docker compose pull backend worker consumer realtime tracking forms admin postgres redis nats

# 2. Build local Hebrew web frontend
Write-Host "`n2. Building local Hebrew web frontend (preserving all translations)..." -ForegroundColor Yellow
docker compose build web

# 3. Bring up all containers
Write-Host "`n3. Starting Warmbly services..." -ForegroundColor Yellow
docker compose up -d

Write-Host "`n=== Update Complete! ===" -ForegroundColor Green
Write-Host "Warmbly Web is running at: http://localhost:28173 with full Hebrew & RTL support." -ForegroundColor Green
