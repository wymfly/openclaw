#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if rg -n -e '(gatewayEndpoint|gateway_endpoint|https?://[^[:space:]]*/(__openclaw__|admin/assets))' frontend-new/src \
  | rg -i 'canvas|a2ui|admin/assets|__openclaw__' \
  | rg -v 'canvas-asset-config|a2ui-bridge.test'; then
  echo "Direct Gateway asset URL in frontend code; use /api/runtime/gateway-assets/*" >&2
  exit 1
fi

echo "canvas asset URLs use BFF reverse-proxy route"
