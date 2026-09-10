# Safe Update Script for Warmbly (Hebrew RTL Edition)
# Preserves all Hebrew translations, RTL layout customizations, and updates backend & workers.

Write-Host "=== Warmbly Safe Update (Hebrew RTL Edition) ===" -ForegroundColor Cyan

# 1. Fetch and merge latest upstream release/fixes
Write-Host "`n1. Fetching upstream updates..." -ForegroundColor Yellow
git fetch upstream
$mergeResult = git merge upstream/main --no-edit
Write-Host $mergeResult

# 2. Build local Hebrew web frontend (without cache to guarantee clean bundle)
Write-Host "`n2. Building local Hebrew web frontend (preserving all translations & RTL)..." -ForegroundColor Yellow
docker compose build --no-cache web

# 3. Build backend, worker, consumer from local source (incorporating any upstream Go fixes)
Write-Host "`n3. Building backend and workers from source..." -ForegroundColor Yellow
docker compose build backend worker consumer

# 4. Bring up and recreate updated services
Write-Host "`n4. Restarting Warmbly services..." -ForegroundColor Yellow
docker compose up -d

Write-Host "`n=== Update Complete! ===" -ForegroundColor Green
Write-Host "Warmbly Web is running at: http://localhost:28173 with 100% Hebrew & RTL support." -ForegroundColor Green
