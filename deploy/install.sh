#!/usr/bin/env bash
# install.sh — One-click installer entry point.
# Forwards to the real install script at scripts/install.sh.
exec "$(dirname "$0")/scripts/install.sh" "$@"
