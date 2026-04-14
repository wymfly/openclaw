# Windows Native Deploy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows-native PowerShell install/update path for `deploy/` that removes the Git Bash requirement for Windows bare-metal installs while preserving the current data-safe upgrade behavior.

**Architecture:** Keep the current PM2-managed bare-metal runtime for this slice, but move Windows orchestration into PowerShell. PowerShell scripts will call the existing Node deploy helpers for seed, PM2 ecosystem generation, and installed-state tracking so behavior stays aligned with the current bash implementation.

**Tech Stack:** PowerShell 5+, Node.js 22+, pnpm, PM2, existing Node deploy helpers in `deploy/scripts/*.js`

---

## Chunk 1: Windows PowerShell helper foundation

### Task 1: Add shared PowerShell helper module

**Files:**

- Create: `deploy/scripts/windows/common.ps1`

- [ ] **Step 1: Define helper responsibilities**

Document and implement helpers for:

- repo/package layout detection
- deploy/package/source directory resolution
- `.env` bootstrap from `.env.example`
- Node/pnpm/PM2 detection
- Windows PATH refresh after installs
- simple logging helpers

- [ ] **Step 2: Implement native dependency helpers**

Add PowerShell functions that:

- detect Node 22+
- install Node using winget/choco/scoop when possible
- install pnpm via corepack or npm
- install PM2 globally

- [ ] **Step 3: Add Node helper invocations**

Implement wrappers to call:

- `deploy/scripts/seed.js`
- `deploy/scripts/generate-ecosystem.js`
- `deploy/scripts/write-installed.js`

- [ ] **Step 4: Syntax-check the helper**

Run: `pwsh -NoLogo -NoProfile -File deploy/scripts/windows/common.ps1`
Expected: no parse errors (script should exit without execution side effects if dot-sourced only)

### Task 2: Add install-or-upgrade PowerShell workflow

**Files:**

- Create: `deploy/scripts/windows/install-or-upgrade.ps1`
- Modify: `deploy/scripts/windows/common.ps1`

- [ ] **Step 1: Port the install flow**

Implement `Install-BareMetal` logic equivalent to the current bash path:

- ensure dependencies
- ensure `.env`
- install runtime deps when `node_modules` missing
- reuse prebuilt artifacts when present
- run seed
- generate ecosystem config
- start PM2
- write installed state

- [ ] **Step 2: Port the upgrade flow**

Implement `Invoke-UpgradeFromPackage` logic equivalent to the current bash path:

- validate package path
- extract package to temp dir
- compare manifest against `.installed.json`
- support `-DryRun`
- backup current install metadata
- preserve `.env` and `data/`
- replace app files
- rerun additive seed
- regenerate ecosystem config
- restart PM2
- emit rollback instructions

- [ ] **Step 3: Port rollback and status primitives**

Add PowerShell functions for:

- rollback
- installed-state read
- process/health status queries for PM2 + localhost probes

- [ ] **Step 4: Syntax-check the workflow**

Run: `pwsh -NoLogo -NoProfile -File deploy/scripts/windows/install-or-upgrade.ps1 -Help`
Expected: usage/help output or clean parameter error, but no parse failure

## Chunk 2: Native Windows entrypoints and packaged output

### Task 3: Add PowerShell entry scripts in `deploy/`

**Files:**

- Create: `deploy/install.ps1`
- Create: `deploy/update.ps1`
- Create: `deploy/start.ps1`
- Create: `deploy/stop.ps1`
- Create: `deploy/status.ps1`

- [ ] **Step 1: Add `install.ps1`**

It should import `deploy/scripts/windows/install-or-upgrade.ps1` and support:

- default install
- `-Mode bare-metal`
- `-UpgradePackage <path>`
- `-DryRun`
- `-Rollback`
- `-Status`

- [ ] **Step 2: Add `update.ps1`**

Implement a thin wrapper that forwards to `install.ps1 -UpgradePackage ...`.

- [ ] **Step 3: Add `start.ps1`, `stop.ps1`, `status.ps1`**

These should provide Windows-native equivalents to the current shell scripts, using PM2 and localhost probes.

- [ ] **Step 4: Verify script help/syntax**

Run:

- `pwsh -NoLogo -NoProfile -File deploy/install.ps1 -Help`
- `pwsh -NoLogo -NoProfile -File deploy/update.ps1 -Help`
- `pwsh -NoLogo -NoProfile -File deploy/status.ps1`

Expected: no parse failures; help or benign no-install status output.

### Task 4: Retarget batch wrappers for Windows-native execution

**Files:**

- Modify: `deploy/install.bat`
- Modify: `deploy/start.bat`
- Modify: `deploy/stop.bat`
- Modify: `deploy/status.bat`

- [ ] **Step 1: Make `.bat` prefer PowerShell**

Update wrappers to invoke sibling `.ps1` files first.

- [ ] **Step 2: Keep fallback compatibility**

If PowerShell invocation fails unexpectedly, preserve a helpful error and avoid silently dropping back to bash unless explicitly intended.

- [ ] **Step 3: Manual wrapper check**

Review generated command lines for quoting correctness, especially with spaces in paths.

### Task 5: Stage packaged PowerShell forwarders

**Files:**

- Modify: `deploy/scripts/package.sh`

- [ ] **Step 1: Add top-level `.ps1` forwarders for packaged output**

Ensure extracted deploy bundles contain:

- `install.ps1`
- `update.ps1`
- `start.ps1`
- `stop.ps1`
- `status.ps1`

These forward to `source\\deploy\\*.ps1`, analogous to the existing top-level `.sh` forwarders.

- [ ] **Step 2: Verify `.bat` + packaged `.ps1` alignment**

Confirm copied top-level `.bat` wrappers now find valid sibling `.ps1` files in the package root.

## Chunk 3: Docs and verification

### Task 6: Rewrite Windows deploy docs around PowerShell

**Files:**

- Modify: `deploy/docs/INSTALL-Windows.md`
- Modify: `deploy/README.md`
- Modify: `deploy/CLAUDE.md`
- Modify: `deploy/INSTALL.md`
- Modify: `deploy/scripts/prepare-deps.sh`
- Modify: `deploy/deps/README.md`

- [ ] **Step 1: Update install docs**

Make PowerShell the recommended path.

- [ ] **Step 2: Update update docs**

Document native `update.ps1` usage and dry-run behavior.

- [ ] **Step 3: Preserve offline notes**

Keep any remaining Git Bash references only as fallback/compat paths if still needed.

### Task 7: Verify the slice

**Files:**

- Test: `deploy/install.ps1`
- Test: `deploy/scripts/windows/common.ps1`
- Test: `deploy/scripts/windows/install-or-upgrade.ps1`

- [ ] **Step 1: Run PowerShell syntax checks**

Run the `pwsh -File ...` commands from earlier tasks.

- [ ] **Step 2: Run Windows PowerShell 5.1 validation**

Run the same help/status/dry-run flows with `powershell.exe`, not only `pwsh`, because the target claim is PowerShell 5+ compatibility.

- [ ] **Step 3: Exercise packaged layout and wrapper smoke tests**

Verify:

- packaged top-level `install.ps1` exists
- packaged `cmd /c install.bat` resolves PowerShell correctly
- `update.ps1 -DryRun` works from packaged layout
- rollback path resolves its backup artifacts correctly

- [ ] **Step 4: Run repo formatting/lint checks for touched shell/PowerShell/docs files where applicable**

Run: `pnpm check`
Expected: no new failures caused by the deploy-script/doc changes.

- [ ] **Step 5: Summarize remaining risks**

Call out that PM2 remains the Windows runtime in Phase 1 and that service-model replacement is a Phase 2+ task.
