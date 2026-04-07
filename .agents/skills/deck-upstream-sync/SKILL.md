---
name: deck-upstream-sync
description: End-to-end workflow for syncing the enhanced fork with upstream OpenClaw, detecting Gateway capability gaps, adapting the Deck dashboard protocol layer, and surfacing new feature opportunities. Use when rebasing upstream, after rebase to detect what changed, or when investigating what new Gateway capabilities Deck could leverage.
---

# Deck Upstream Sync & Adaptation

Orchestrates the full cycle: upstream rebase, conflict resolution, protocol sync, capability gap detection, Deck adaptation guidance, and new-feature discovery.

This skill is **checkpoint-driven**: every phase ends with a user confirmation gate. Never proceed to the next phase without explicit approval.

## Prerequisites

Before invoking, verify:

1. On `enhanced` branch: `git branch --show-current` must return `enhanced`
2. Working tree clean: `git status --porcelain` must be empty (commit or stash first)
3. `upstream` remote exists: `git remote get-url upstream` must resolve to `openclaw/openclaw`

If any prerequisite fails, stop and tell the user exactly what to fix.

## Entry Points

This skill supports partial invocation. The user may request any single phase:

| User says                           | Start at                              |
| ----------------------------------- | ------------------------------------- |
| "sync upstream" / "rebase upstream" | Phase 1                               |
| "protocol sync" / "gen protocol"    | Phase 2 (skip rebase)                 |
| "gap report" / "capability diff"    | Phase 3 (skip rebase + protocol gen)  |
| "adapt deck" / "close gaps"         | Phase 4 (assumes gap report exists)   |
| "what's new upstream"               | Phase 5 only (changelog intelligence) |
| "full sync"                         | Phase 1 through 6                     |

## Phase 1: Upstream Rebase

### 1.1 Preparation

```bash
# Record checkpoint for rollback
git rev-parse HEAD  # → save as $CHECKPOINT

# Fetch upstream
git fetch upstream main --tags

# Show what we're about to absorb
git log --oneline enhanced..upstream/main | head -30
git log --oneline enhanced..upstream/main | wc -l
```

Report to user:

- Number of upstream commits since last sync
- Latest upstream tag version
- Date range of changes

**[CHECKPOINT] Ask user: "Upstream has N commits since last sync (version X → Y). Proceed with rebase?"**

### 1.2 Rebase Execution

```bash
git rebase upstream/main
```

**If conflicts occur:**

1. Show conflict summary: `git diff --name-only --diff-filter=U`
2. Categorize conflicting files:
   - **Protocol/Schema** (`src/gateway/protocol/`, `src/gateway/method-registry-data.ts`, `src/gateway/server-methods-list.ts`) — usually append-only, resolve by keeping both
   - **Server Methods** (`src/gateway/server-methods/`) — our `deck/*` files should have zero conflict; upstream files resolve by accepting upstream
   - **Enhanced modules** (`src/security/`, `src/retry/`, etc.) — keep ours, adjust imports if upstream changed surrounding code
   - **Config types** (`src/config/types.*.ts`) — accept upstream, re-apply our minimal insertions
   - **Dashboard** (`dashboard/`) — keep ours entirely (our code, not upstream)
   - **Extensions** (`extensions/`) — keep ours for wecom; accept upstream for others
3. For each conflict, show the diff and propose resolution
4. **[CHECKPOINT] Ask user to confirm each non-trivial conflict resolution**
5. `git rebase --continue` after each resolution

**If rebase fails catastrophically:** `git rebase --abort` to return to `$CHECKPOINT`. Report failure and stop.

### 1.3 Post-Rebase Verification

```bash
pnpm install          # deps may have changed
pnpm build            # Gateway must compile (catches schema drift)
```

If `pnpm build` fails:

- Check for `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings
- Check for TypeScript errors in `src/` (not `dashboard/` yet)
- Fix iteratively; these are usually import path changes from upstream refactors

**[CHECKPOINT] Report rebase result: "Rebase complete. N conflicts resolved. `pnpm build` status: pass/fail."**

## Phase 2: Protocol SDK Sync

### 2.1 Detect Registry Changes

```bash
# What changed in the method registry since our last sync?
git diff $CHECKPOINT..HEAD --stat -- \
  src/gateway/server-methods-list.ts \
  src/gateway/method-registry-data.ts \
  src/gateway/protocol/schema/ \
  src/gateway/server-methods/

# New methods added?
git diff $CHECKPOINT..HEAD -- src/gateway/method-registry-data.ts | grep '^+.*"' | grep -v '^+++'

# Schema changes?
git diff $CHECKPOINT..HEAD --stat -- src/gateway/protocol/schema/
```

Report to user:

- New methods added to `allMethodNames`
- Modified schemas
- New handler files

### 2.2 Sync methodDefs for New Upstream Methods

For each new method in `allMethodNames` that doesn't have a corresponding entry in `allMethodDefs`:

1. Check if the handler already has a result schema in `src/gateway/protocol/schema/`
2. If yes → add `methodDefs` entry (params + result + scope) in the appropriate `*-method-defs.ts` file
3. If no → decide later in Phase 4 whether Deck needs it; for now, the method stays untyped

**Do NOT write result schemas for methods Deck won't use** (node.\*, heartbeat, internal signals). Save effort for Phase 4 prioritization.

### 2.3 Regenerate Protocol Types

```bash
pnpm protocol:gen:ts
```

This regenerates:

- `dashboard/src/types/gateway-protocol.generated.ts` (type definitions)
- `dashboard/src/types/gateway-client.generated.ts` (typed client + allowlist)

### 2.4 Fix Dashboard Type Errors

```bash
cd dashboard && npx tsc --noEmit 2>&1 | head -50
```

Common fixes after upstream sync:

- **Field renamed** → update Deck store/component references
- **Field added (optional)** → usually no fix needed
- **Field removed** → remove Deck references, may need UI adjustment
- **Type changed** → update Deck types to match

Fix all type errors before proceeding. Run `npx tsc --noEmit` until clean.

### 2.5 Verify

```bash
pnpm protocol:gen:check   # must pass — generated files match registry
```

**[CHECKPOINT] Report: "Protocol sync complete. N new methods added to allowlist. M type errors fixed. `protocol:gen:check` passes."**

## Phase 3: Capability Gap Detection

### 3.1 Run Gap Analysis

```bash
bun scripts/protocol-coverage-check.ts
```

This reports:

- Total registered methods vs schema-backed methods
- Methods used via typed client (`gw.*`) vs untyped (`gatewayRequest`)
- Coverage by method family
- Not-covered methods (registered but Deck doesn't use)

### 3.2 Deep Classification

Run the following to produce the three-tier classification:

```bash
bun -e "
import { allMethodDefs, allMethodNames } from './src/gateway/method-registry-data.ts';
import { GENERATED_METHOD_ALLOWLIST } from './dashboard/src/types/gateway-client.generated.ts';

const full = [], partial = [], untyped = [];
const deckRelevant = [], internal = [];

for (const name of allMethodNames) {
  const def = allMethodDefs[name];
  if (!def) untyped.push(name);
  else if (def.result) full.push(name);
  else partial.push(name);
}

// Classify untyped by Deck relevance
const INTERNAL_PREFIXES = ['node.', 'system-', 'last-', 'set-heartbeat', 'send', 'agent', 'wake', 'heartbeat', 'presence'];
const INTERNAL_EXACT = new Set(['send', 'agent', 'wake', 'heartbeat', 'presence', 'system-presence', 'system-event', 'last-heartbeat', 'set-heartbeats']);

for (const m of untyped) {
  if (INTERNAL_EXACT.has(m) || INTERNAL_PREFIXES.some(p => m.startsWith(p) && !m.startsWith('agents.'))) {
    internal.push(m);
  } else {
    deckRelevant.push(m);
  }
}

// New since last protocol gen
const newInAllowlist = [...GENERATED_METHOD_ALLOWLIST].filter(m => !full.includes(m) && !partial.includes(m));

console.log('=== GAP REPORT ===');
console.log('Full (typed client ready):', full.length);
console.log('Partial (in allowlist, no result type):', partial.length);
console.log('Untyped - Deck relevant:', deckRelevant.length);
console.log('Untyped - Internal (skip):', internal.length);
console.log();
console.log('--- PARTIAL (low cost to complete) ---');
partial.forEach(m => console.log('  ', m));
console.log();
console.log('--- UNTYPED but Deck-relevant (evaluate for adaptation) ---');
deckRelevant.forEach(m => console.log('  ', m));
console.log();
console.log('--- INTERNAL (no action needed) ---');
internal.forEach(m => console.log('  ', m));
"
```

### 3.3 Generate Gap Report

Produce a structured summary grouped by namespace:

| Namespace     | Count | Tier             | Action                        |
| ------------- | ----- | ---------------- | ----------------------------- |
| `talk.*`      | 3     | Untyped/Relevant | Evaluate: voice control panel |
| `tts.*`       | 5     | Untyped/Relevant | Evaluate: TTS settings panel  |
| `wizard.*`    | 4     | Untyped/Relevant | Evaluate: setup wizard        |
| `device.*`    | 5     | Untyped/Relevant | Evaluate: device management   |
| `voicewake.*` | 2     | Untyped/Relevant | Evaluate: wake word config    |
| `secrets.*`   | 2     | Untyped/Relevant | Evaluate: secrets management  |
| `usage.cost`  | 1     | Partial          | Add result schema             |
| `node.*`      | 19    | Internal         | Skip                          |

**[CHECKPOINT] Present gap report to user. Ask: "Which namespaces/methods would you like to adapt for Deck? Or skip to Phase 5 for changelog-based feature discovery first?"**

## Phase 4: Guided Adaptation

For each method the user chooses to adapt, follow the tier-specific workflow:

### Tier: PARTIAL → Add Result Schema

Cost: ~10-15 min per method. Handler already exists, just needs type annotation.

1. **Read the handler** to understand response shape:
   ```bash
   grep -A 30 '"<method.name>"' src/gateway/server-methods/<file>.ts
   ```
2. **Check if a result schema already exists** in `src/gateway/protocol/schema/`:
   ```bash
   grep -rn '<MethodName>Result' src/gateway/protocol/schema/
   ```
3. **If schema exists** → add `result: XxxResultSchema` to the methodDefs entry
4. **If schema doesn't exist** → create TypeBox schema in appropriate schema file, then add to methodDefs
5. **Re-run codegen**:
   ```bash
   pnpm protocol:gen:ts
   cd dashboard && npx tsc --noEmit
   ```

### Tier: UNTYPED → Full Registration

Cost: ~20-40 min per method. Need both params schema, result schema, and methodDefs entry.

1. **Read the handler** to understand params validation and response shape
2. **Check for existing schemas** in `src/gateway/protocol/schema/`
3. **Create missing schemas** (TypeBox) — follow existing patterns in same schema file
4. **Register in methodDefs**:
   - If the method is in `deck.*` namespace → add to `src/gateway/server-methods/deck/` methodDefs
   - If it's an upstream control-plane method → add to `control-plane-method-defs.ts`
   - Set the correct `scope` (check `method-scopes.ts`)
5. **Add to `allMethodNames`** in `method-registry-data.ts` if not already there
6. **Re-run codegen**:
   ```bash
   pnpm protocol:gen:ts
   cd dashboard && npx tsc --noEmit
   ```

### After Each Batch

```bash
pnpm protocol:gen:check    # generated files match registry
pnpm check                 # lint + format
cd dashboard && npx tsc --noEmit  # zero type errors
```

**[CHECKPOINT] After each namespace batch: "Adapted N methods in `<namespace>`. Types clean. Continue with next namespace?"**

## Phase 5: Changelog Intelligence

### 5.1 Extract Deck-Relevant Changes

```bash
# Find version range
OLD_VERSION=$(git log --oneline $CHECKPOINT | head -1 | grep -oP 'v?\d{4}\.\d+\.\d+' || echo "unknown")

# Extract Changes sections from CHANGELOG between old and new
git show upstream/main:CHANGELOG.md | \
  awk "/^## /{found=0} /^## .*${OLD_VERSION}/{found=0; exit} /^## /{found=1} found"
```

### 5.2 Filter for Deck-Relevant Entries

Scan extracted changelog for keywords indicating Deck-relevant changes:

- **Gateway/API**: "Gateway", "RPC", "API", "endpoint", "method"
- **Sessions/Agents**: "sessions", "agents", "subagent", "spawn"
- **Models/Providers**: "models", "provider", "catalog", "fallback"
- **Tools**: "tools", "tool policy", "approval", "sandbox"
- **Config**: "config", "schema", "settings"
- **UI**: "Control UI", "dashboard", "web"
- **Breaking**: all `### Breaking` entries

### 5.3 Cross-Reference with Gap Report

For each Deck-relevant changelog entry:

1. Identify which Gateway method(s) it relates to
2. Check if that method is in the gap report (PARTIAL or UNTYPED)
3. Flag as "new feature opportunity" if the method is already adapted but the UI doesn't surface the new capability

### 5.4 Feature Discovery Report

Present to user:

```
=== New Feature Opportunities ===

1. Task Flow (v2026.4.2)
   Methods: tasks.flow.create, tasks.flow.list, tasks.flow.cancel
   Status: NOT registered (upstream added, our fork doesn't have methodDefs)
   Potential: Background task orchestration panel in Deck
   Effort: Medium (new namespace, need schemas + UI)

2. Voice Controls (v2026.4.1)
   Methods: talk.config, talk.mode, talk.speak
   Status: UNTYPED (handler exists, no schema)
   Potential: Voice/Talk settings panel
   Effort: Low (schemas exist in protocol/schema/channels.ts)

3. TTS Integration (existing)
   Methods: tts.status, tts.providers, tts.enable, tts.disable
   Status: UNTYPED
   Potential: Text-to-speech configuration panel
   Effort: Low-Medium

4. Device Management (existing)
   Methods: device.pair.list, device.pair.approve/reject/remove
   Status: UNTYPED
   Potential: Paired devices management panel
   Effort: Medium (need schemas, new UI panel)

=== Breaking Changes Affecting Deck ===
- [list any breaking changes that touch Deck-consumed APIs]
- [flag if any existing Deck features need updating]
```

**[CHECKPOINT] Present feature discovery report. Ask: "Which new features would you like to develop Deck panels for? I'll create design proposals for each."**

## Phase 6: Verification & Commit

### 6.1 Full Verification Suite

```bash
pnpm install
pnpm check                 # lint + format
pnpm build                 # Gateway compiles
pnpm protocol:gen:check    # protocol types in sync
cd dashboard && npx tsc --noEmit  # Deck types clean
pnpm test                  # full test suite (or scoped if >5min)
```

### 6.2 Commit Convention

Commits from this workflow use the `[enhanced]` prefix:

```
[enhanced] chore: sync upstream v2026.X.Y, adapt N new Gateway methods

- Rebased onto upstream/main (vOLD → vNEW)
- Protocol SDK: added result schemas for <methods>
- Gap closed: <namespaces> now in typed client
- Breaking changes addressed: <list>
```

Split into logical commits:

1. **Rebase fixups**: `[enhanced] chore: post-rebase fixups — resolve conflicts, update imports`
2. **Protocol sync**: `[enhanced] chore: regenerate protocol types, add methodDefs for new methods`
3. **Schema additions**: `[enhanced] feat(protocol): add result schemas for <namespace>` (one per namespace)
4. **Dashboard fixes**: `[enhanced] fix(deck): update types for upstream schema changes`

### 6.3 Push

```bash
git push --force-with-lease origin enhanced
```

**[CHECKPOINT] "All checks pass. Ready to push. Confirm?"**

## Troubleshooting

### Rebase conflict in `server-methods-list.ts`

This file is append-only. Keep both our entries and upstream's. Sort is not required.

### Rebase conflict in `method-registry-data.ts`

Same as above — `allMethodNames` is append-only. Keep both, deduplicate if needed.

### `pnpm build` fails after rebase

Usually means upstream renamed/moved a module. Check the import that fails, find where it moved, update our imports.

### `protocol:gen:check` fails after `protocol:gen:ts`

This means the generated output doesn't match. Re-run `pnpm protocol:gen:ts` and commit the result.

### Dashboard type errors after protocol gen

Read the error. Usually one of:

- Field was renamed → update all references in `dashboard/src/`
- Field was removed → remove usage, may need UI fallback
- New required field in params → add to store call sites

### Schema version mismatch at runtime

Gateway logs `schema version mismatch`. Run `pnpm protocol:gen:ts` and rebuild dashboard.

## Quick Reference

| Command                                  | Purpose                                |
| ---------------------------------------- | -------------------------------------- |
| `git fetch upstream main --tags`         | Fetch upstream without modifying local |
| `git rebase upstream/main`               | Rebase enhanced onto latest upstream   |
| `pnpm protocol:gen:ts`                   | Regenerate typed client from registry  |
| `pnpm protocol:gen:check`                | Verify generated files are in sync     |
| `bun scripts/protocol-coverage-check.ts` | Gap analysis report                    |
| `cd dashboard && npx tsc --noEmit`       | Dashboard type check                   |
| `pnpm check`                             | Lint + format                          |
| `pnpm build`                             | Full Gateway build                     |
| `pnpm test`                              | Full test suite                        |

## Method Adaptation Quick Path

For a single method `foo.bar`:

```bash
# 1. Find handler
grep -rn '"foo.bar"' src/gateway/server-methods/ --include="*.ts" -A 20

# 2. Find existing schemas
grep -rn 'FooBar.*Schema' src/gateway/protocol/schema/

# 3. Add to methodDefs (in appropriate file)
# 4. Re-run codegen
pnpm protocol:gen:ts

# 5. Verify
pnpm protocol:gen:check
cd dashboard && npx tsc --noEmit
```
