#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

violations="$(
  rg -n -e '([A-Za-z0-9_$.]+mode|runtimeMode|capabilities\.mode)\s*(===|!==)\s*"(bundled|remote)"|is(Bundled|Remote)RuntimeStatus' frontend-new/src --glob '*.{ts,tsx}' \
    | rg -v 'frontend-new/src/api.ts' \
    | rg -v 'frontend-new/src/stream-contract.ts' \
    | rg -v 'frontend-new/src/components/panels/gateway/GatewayPanel.tsx' \
    | rg -v '\.test\.' || true
)"

if [[ -n "$violations" ]]; then
  echo "$violations" >&2
  echo "Rule R2 violation: runtime behavior must use capabilities/facade state, not mode branches." >&2
  exit 1
fi

echo "R2 guard passed"
