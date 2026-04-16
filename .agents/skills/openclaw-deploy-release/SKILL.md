---
name: openclaw-deploy-release
description: Prepare and operate OpenClaw deploy releases, especially the validated Windows self-contained flow. Use when packaging a new deploy tarball, publishing release artifacts to the Windows release host, generating a self-contained Windows package with source/node_modules, verifying install or update behavior, checking that user data survives updates, or cleaning old release/test artifacts while keeping one healthy service online.
---

# OpenClaw Deploy Release

## Overview

Use this skill to run the validated OpenClaw release workflow: build a local base deploy tarball, turn it into a Windows self-contained package on the release server, publish the final bootstrap assets on an independent HTTP port, verify install/update with health checks, and clean temporary artifacts without deleting the one service you intend to keep.

## Core rules

- Treat the **Windows self-contained package** as the user-facing artifact. Do not publish a plain base tarball to Windows users.
- Treat the **release HTTP service** as a separate concern from Deck. Do not reuse Deck's `3340` port to serve install assets.
- Treat the **base tarball** as an intermediate artifact used to produce the self-contained package.
- For Windows validation, prefer an **isolated install root + custom ports + unique startup task name**.
- Prioritize proving the main user path: **install works, update works, user data survives update**.
- Only spend time on rollback when explicitly requested.
- Before cleanup, ensure **one chosen service is healthy** and know which install root you are preserving.
- Treat `deploy/STATUS.md` as the deployment source of truth. After any deploy, publish, validation, or rollback step that changes reality, update `deploy/STATUS.md` before you stop.

## Workflow

1. **Build the local base tarball**.
   - Use the local repo to create a `--with-prebuilt` deploy tarball.
   - If the task is specifically to produce a self-contained package on the same platform, you may use `--windows-self-contained` instead.
2. **Upload the base tarball to the Windows release host**.
   - Publish it under a staging directory such as `D:\openclaw\publish\latest`.
3. **Generate the Windows self-contained package on the release host**.
   - Use the host's Windows `source\node_modules` as the runtime dependency source.
   - Publish the final artifacts under a dedicated HTTP directory such as `D:\openclaw\publish\selfcontained-<label>`.
4. **Validate the main path**.
   - Fresh install from the self-contained package into an isolated root.
   - Confirm Gateway and Deck reach healthy HTTP responses.
   - Write user-data sentinels, run update, and confirm sentinels plus config hash survive.
5. **Clean temporary artifacts**.
   - Keep the final publish directory, the source checkout used for Windows node_modules, and one healthy install root.
   - Remove old self-test roots, stale `.update-*` / `.rollback-*` staging dirs, and scratch scripts/logs in `publish/` that are not part of the final release.
6. **Update deployment state documentation**.
   - Update `deploy/STATUS.md` with the latest live root, backup path, publish directory, verification result, and remaining deployment gap.
   - If the handoff guidance changed materially, update `deploy/HANDOFF.md` too.

## What to read next

- For the exact validated release commands and cleanup checklist, read `references/validated-release-flow.md`.
