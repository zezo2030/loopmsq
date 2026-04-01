#!/bin/sh
set -eu

# Resolve API base URL from env
# If relative path (starts with /), use as-is (nginx will handle it)
# If absolute URL, use it directly
# Otherwise, fallback to localhost:3000
API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:3000/api/v1}"

# If API_BASE is a relative path (starts with /), keep it as-is
# Otherwise, ensure it's a full URL
if [ "${API_BASE#/}" != "${API_BASE}" ]; then
    # Relative path - use as-is
    FINAL_API_BASE="${API_BASE}"
else
    # Absolute URL - use as-is
    FINAL_API_BASE="${API_BASE}"
fi

export FINAL_API_BASE
export VITE_GOOGLE_MAPS_API_KEY="${VITE_GOOGLE_MAPS_API_KEY:-}"

# JSON-escape values (Google Maps key is not in the Docker build because .env is dockerignored)
node <<'NODE'
const fs = require('fs');
const path = '/usr/share/nginx/html/runtime-config.js';
const api = process.env.FINAL_API_BASE || 'http://localhost:3000/api/v1';
const maps = process.env.VITE_GOOGLE_MAPS_API_KEY || '';
const out =
  'window.NEXT_PUBLIC_API_BASE = ' +
  JSON.stringify(api) +
  ';\nwindow.VITE_GOOGLE_MAPS_API_KEY = ' +
  JSON.stringify(maps) +
  ';\n';
fs.writeFileSync(path, out);
NODE

exec nginx -g 'daemon off;'
