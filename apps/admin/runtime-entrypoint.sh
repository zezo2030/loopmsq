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

# Write runtime-config.js to be loaded by index.html
cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.NEXT_PUBLIC_API_BASE = "${FINAL_API_BASE}";
EOF

exec nginx -g 'daemon off;'


