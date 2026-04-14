# Windows Native Deploy Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hostable one-command Windows bootstrap installer/update flow for deploy packages.

**Architecture:** A small PowerShell bootstrap script downloads a hosted JSON manifest, fetches the latest deploy tarball, verifies its SHA-256, and then delegates to the packaged installer for fresh install or the installed updater for upgrades.

**Tech Stack:** PowerShell 5+, static HTTP hosting, package SHA-256 verification, existing packaged `install.ps1` / `update.ps1`

---

## Chunk 1: Bootstrap assets

### Task 1: Add a reusable bootstrap PowerShell installer

**Files:**

- Create: `deploy/bootstrap-install.ps1`

- [ ] Accept install root, manifest URL, package URL override, and dry-run flags.
- [ ] Download the manifest/package with PowerShell web APIs.
- [ ] Verify package SHA-256.
- [ ] Fresh install by extracting into the target install root and invoking packaged `install.ps1`.
- [ ] Upgrade by invoking installed `update.ps1 -Package <downloaded tgz>`.

## Chunk 2: Package publishing metadata

### Task 2: Teach package.sh to emit hosted Windows bootstrap assets

**Files:**

- Modify: `deploy/scripts/package.sh`

- [ ] Add an option like `--bootstrap-base-url <https://host/path>`.
- [ ] Compute SHA-256 for the generated tarball.
- [ ] Write `windows-latest.json` to the output directory.
- [ ] Materialize `install.ps1` in the output directory from `deploy/bootstrap-install.ps1` with the manifest URL embedded.

## Chunk 3: Docs and verification

### Task 3: Document the one-liner flow

**Files:**

- Modify: `deploy/README.md`
- Modify: `deploy/docs/INSTALL-Windows.md`
- Modify: `deploy/INSTALL.md`
- Modify: `deploy/CLAUDE.md`

- [ ] Document how to publish the bootstrap assets.
- [ ] Document the final one-liner install command.
- [ ] Document that updates can happen by rerunning the bootstrap one-liner.

### Task 4: Run available verification

**Files:**

- Test: `deploy/bootstrap-install.ps1`
- Test: `deploy/scripts/package.sh`

- [ ] Run shell syntax checks and `git diff --check`.
- [ ] Build a source-only package with `--bootstrap-base-url`.
- [ ] Verify the output directory contains `.tar.gz`, `install.ps1`, and `windows-latest.json` with consistent package references.
- [ ] Summarize remaining unverified Windows-only bootstrap execution because the current host lacks PowerShell.
