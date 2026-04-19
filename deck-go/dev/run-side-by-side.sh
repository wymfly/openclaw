#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "deck-go side-by-side helper"
echo
echo "Legacy Deck path: $ROOT/dashboard"
echo "New Deck path:    $ROOT/deck-go"
echo
echo "Suggested parallel launch:"
echo
echo "1. Legacy Deck:"
echo "   cd \"$ROOT/dashboard\" && pnpm dev"
echo
echo "2. deck-go backend:"
echo "   \"$ROOT/deck-go/dev/run-backend.sh\""
echo
echo "3. deck-go frontend:"
echo "   \"$ROOT/deck-go/dev/run-frontend.sh\""
