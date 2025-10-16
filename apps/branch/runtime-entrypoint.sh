#!/bin/sh
set -eu

API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:3000/api/v1}"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.NEXT_PUBLIC_API_BASE = "${API_BASE}";
EOF

exec nginx -g 'daemon off;'


