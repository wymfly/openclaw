# Windows Native Deploy Phase 3 Design

## Goal

Add a hostable Windows bootstrap installer/update flow so users can install or update OpenClaw Deploy from a single PowerShell command without manually unpacking a deploy tarball first.

## Scope

Phase 3 builds on the completed Windows bare-metal runtime from Phase 2.

- keep the package format (`openclaw-deploy-*.tar.gz`)
- add a hostable bootstrap `install.ps1`
- add a hosted manifest JSON that points to the latest Windows deploy package
- add packaging support to emit both assets for publication

## Runtime/install model

The bootstrap script does not replace the packaged installer. It orchestrates it:

1. Download `windows-latest.json`
2. Resolve `packageUrl` + expected SHA-256
3. Download package to a temp file
4. Fresh install:
   - extract the package into a stable install root
   - run the packaged `install.ps1`
5. Upgrade:
   - run the already-installed `update.ps1 -Package <downloaded tgz>`

This keeps all data preservation and rollback behavior inside the packaged installer, rather than duplicating it in the bootstrap layer.

## Publishing model

When `deploy/scripts/package.sh` is run with a bootstrap base URL, it should emit alongside the `.tar.gz`:

- `install.ps1` (bootstrap installer with the manifest URL embedded)
- `windows-latest.json` (points to the package URL and checksum)

That makes it easy to publish a static HTTP directory or website bucket.

## Out of scope

- macOS/Linux bootstrap changes
- winget/MSIX/MSI
- changing the packaged install/update internals
