#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r backend/requirements.txt -q

cd web
npm install --no-audit --no-fund
npm run build
cd ..

if pm2 describe part-finder >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save
echo "Deploy selesai. Cek: curl -s http://localhost:3230/api/health"
