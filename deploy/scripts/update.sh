#!/usr/bin/env bash
#
# update.sh — Backward-compatible shim. Forwards to install.sh --upgrade.
#
# Usage:
#   deploy/scripts/update.sh <new-package.tar.gz>        # Update from package
#   deploy/scripts/update.sh <new-package.tar.gz> --dry   # Preview changes only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

PACKAGE="${1:-}"
DRY_FLAG=""
[ "${2:-}" = "--dry" ] && DRY_FLAG="--dry"

if [ -z "$PACKAGE" ] || [ "$PACKAGE" = "--dry" ]; then
  echo "Usage: $0 <new-package.tar.gz> [--dry]"
  echo ""
  echo "  This script now forwards to: install.sh --upgrade"
  echo "  Run directly: bash deploy/scripts/install.sh --upgrade <package> [--dry]"
  exit 1
fi

exec "$SCRIPT_DIR/install.sh" --upgrade "$PACKAGE" $DRY_FLAG
