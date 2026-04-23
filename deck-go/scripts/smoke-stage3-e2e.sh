#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_GATEWAY_TOKEN="${DECK_GO_STAGE3_E2E_GATEWAY_TOKEN:-stage3-gateway-token}"

echo "[stage3-e2e] basic active-host smoke"
(
  cd "${ROOT_DIR}"
  ./scripts/smoke-stage3-host.sh
)

echo
echo "[stage3-e2e] rich managed-runtime smoke"
(
  cd "${ROOT_DIR}"
  DECK_GO_SMOKE_GATEWAY_TOKEN="${DEFAULT_GATEWAY_TOKEN}" ./scripts/smoke-stage3-host.sh
)

echo
echo "[stage3-e2e] canonical Stage 3 host workflows passed"
