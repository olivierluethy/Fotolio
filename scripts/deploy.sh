#!/usr/bin/env bash
# Fotolio deploy helper. Idempotent, non-destructive. Configure the vars below
# (or pass as env) and run on the target host, or over SSH from CI.
#
#   REMOTE_PATH=/var/www/fotolio ./scripts/deploy.sh
#
# It pulls the latest code, installs deps, builds the SPA, and runs migrations.
# It NEVER drops tables or deletes user data.
set -euo pipefail

REMOTE_PATH="${REMOTE_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${BRANCH:-main}"

echo "▶ Deploying Fotolio in ${REMOTE_PATH} (branch ${BRANCH})"
cd "$REMOTE_PATH"

echo "▶ Pulling latest code"
git fetch --all --quiet
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "▶ Installing PHP dependencies"
cd "$REMOTE_PATH/api"
composer install --no-dev --optimize-autoloader --no-interaction

echo "▶ Running database migrations"
php bin/console migrate

echo "▶ Building the dashboard SPA"
cd "$REMOTE_PATH/dashboard"
npm ci
npm run build

echo "▶ Fixing storage permissions"
cd "$REMOTE_PATH/api"
mkdir -p storage/originals storage/tmp public/media
chmod -R u+rwX storage public/media || true

echo "✔ Deploy complete."
echo "  Public sites are served by api/public/index.php via the Host header."
echo "  Dashboard build is in dashboard/dist (serve as static, proxy /api + /media to PHP)."
