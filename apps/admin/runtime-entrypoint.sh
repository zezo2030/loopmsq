#!/bin/sh
set -eu

# Resolve API base URL from env, fallback to localhost
API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:3000/api/v1}"

# Write runtime-config.js to be loaded by index.html
cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.NEXT_PUBLIC_API_BASE = "${API_BASE}";
EOF

exec nginx -g 'daemon off;'


