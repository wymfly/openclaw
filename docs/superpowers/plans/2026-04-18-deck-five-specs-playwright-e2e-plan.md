# Deck Five Specs Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Related specs:** `docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`, `docs/superpowers/specs/2026-04-17-deck-manifest-driven-wizard-design.md`, `docs/superpowers/specs/2026-04-17-deck-plugin-manifest-expansion-design.md`, `docs/superpowers/specs/2026-04-18-deck-local-ui-registry-boundary-design.md`, `docs/superpowers/specs/2026-04-18-deck-wecom-page-shell-design.md`
> **Date:** 2026-04-18
> **Branch:** `enhanced`

**Goal:** Add thin but authoritative Playwright E2E coverage for the five recent Deck specs, with priority on the corrective local-authority and WeCom page-shell work that landed after Specs 1 to 3.

**Architecture:** Split Playwright coverage into three lanes: a deterministic mocked-API regression lane for PR gating, a local Gateway live-smoke lane for integration sanity, and an optional WeCom live lane for environment-specific operator smoke. Reuse the current dashboard E2E harness, but move channel/plugin/routing stubbing into explicit helpers so journeys map cleanly to spec boundaries instead of ad hoc panel smoke.

**Tech Stack:** Playwright, Next.js dashboard, dashboard API route mocking, local Gateway via `scripts/dev/deck-dev.sh`, local source `pnpm openclaw gateway`.

---

## 0 Spec recall and correction mapping

Based on the current `.omx/context/*` and `docs/superpowers/{specs,plans}` artifacts, the five-spec sequence to cover is:

1. `deck-access-model-contract`
2. `deck-manifest-driven-wizard`
3. `deck-plugin-manifest-expansion`
4. `deck-local-ui-registry-boundary`
5. `deck-wecom-page-shell`

For this test plan, treat Specs 4 and 5 as the corrective layer over Specs 1 to 3:

- Spec 4 recenters UI ownership inside Deck authority and removes the scattered hardcoded channel branching risk introduced while Specs 1 to 3 were landing.
- Spec 5 turns the earlier WeCom operator work into the current `Overview + Onboarding + Access` page-shell model on top of the Spec 4 authority boundary.

This means the E2E suite should not test the older intermediate states separately. It should test the current corrected behavior after Specs 4 and 5.

---

## 1 Current Playwright baseline and gaps

Current dashboard Playwright coverage exists in:

- `dashboard/e2e/navigation.spec.ts`
- `dashboard/e2e/onboarding.spec.ts`
- `dashboard/e2e/settings.spec.ts`
- `dashboard/e2e/models.spec.ts`
- `dashboard/e2e/doc-hub.spec.ts`
- `dashboard/e2e/deck-regressions.spec.ts`
- `dashboard/e2e/live-smoke.spec.ts`

Current gaps relative to the five specs:

- No Playwright journey covers WeCom `Overview / Onboarding / Access` page-shell behavior.
- No Playwright journey covers `AccessDescriptor` handoff from overview/status into Access.
- No Playwright journey covers Feishu `setupWizardSpec` plus `WizardRunner` plus plugin locale/action metadata together.
- No Playwright journey covers `CapabilityActionBar` as a plugin-metadata-driven surface.
- No Playwright journey proves the Spec 4 authority takeover for bespoke vs generic channel UI.
- No Playwright journey proves channel runtime truth vs plugin inventory truth on the same screen flow.
- The only live coverage is `live-smoke.spec.ts`, which stops at dashboard boot and a few generic panels.

Design rule for this lane:

- New tests must follow web-first assertions and semantic locators.
- Do not extend the older timeout-heavy style in some existing E2E files.
- Keep E2E thin: cover spec-critical user journeys only.

---

## 2 Target lane structure

### Lane A: Mocked regression lane

Purpose:

- Default PR gate
- Deterministic coverage for current corrected UX
- No dependency on a real Gateway, plugin install state, or channel credentials

Files to add:

- `dashboard/e2e/wecom-channel-journey.spec.ts`
- `dashboard/e2e/feishu-wizard-journey.spec.ts`
- `dashboard/e2e/generic-channel-fallback.spec.ts`
- `dashboard/e2e/channel-fixtures.ts`

Files to modify:

- `dashboard/e2e/helpers.ts`
- `dashboard/playwright.config.ts`

### Lane B: Local Gateway live-smoke lane

Purpose:

- Prove the dashboard can exercise the current live Deck runtime with a real local Gateway
- Extend the current `live-smoke.spec.ts` from generic boot smoke into channel/plugin surface smoke

Files to add:

- `dashboard/e2e/live-channels-smoke.spec.ts`

Files to modify:

- `dashboard/e2e/live-smoke.spec.ts`
- `dashboard/playwright.config.ts`

### Lane C: Optional WeCom live lane

Purpose:

- Operator-only smoke for environments where WeCom is actually configured
- Not a default PR gate
- Explicitly non-destructive

Files to add:

- `dashboard/e2e/live-wecom-smoke.spec.ts`

Files to modify:

- `dashboard/playwright.config.ts`

---

## Chunk 1: Shared fixture and route scaffold

### Task 1: Normalize dashboard shell helpers

**Files:**

- Modify: `dashboard/e2e/helpers.ts`
- Create: `dashboard/e2e/channel-fixtures.ts`

- [ ] Add typed builders for:
  - mocked channel entries
  - mocked plugin inventory entries
  - mocked routing bindings
  - mocked config patch responses
- [ ] Add a single helper to stub the base shell plus channel/plugin/routing surfaces:
  - `/api/onboarding/status`
  - `/api/settings`
  - `/api/gateway/status`
  - `/api/channels`
  - `/api/deck/plugins`
  - `/api/deck/routing`
  - `/api/config/patch`
  - `/api/channels/[channelId]/test`
- [ ] Keep `setEnglishLocale(...)` as the default setup for all new spec-critical tests.
- [ ] Prefer route builders that expose payload capture so E2E can assert save/probe requests instead of only DOM state.

### Task 2: Stabilize Playwright lane gating

**Files:**

- Modify: `dashboard/playwright.config.ts`

- [ ] Keep the current default local dev server behavior.
- [ ] Add env-driven grep/tag guidance for:
  - mocked regression
  - live smoke
  - optional WeCom live smoke
- [ ] Keep live tests single-worker.
- [ ] Keep trace capture on retry/failure for live mode.
- [ ] Do not add a second auto-starting server path; continue to use `PLAYWRIGHT_EXTERNAL_SERVER=1` for external live runs.

Expected execution commands after this chunk:

```bash
pnpm --dir dashboard test:e2e --grep @mock
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 pnpm --dir dashboard test:e2e --grep @live
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 PLAYWRIGHT_LIVE_WECOM=1 pnpm --dir dashboard test:e2e --grep @live-wecom
```

---

## Chunk 2: WeCom corrected operator journey

This chunk is the main proof for Specs 1, 4, and 5.

### Task 3: Cover WeCom page-shell navigation and hidden-page contract

**Files:**

- Create: `dashboard/e2e/wecom-channel-journey.spec.ts`
- Read for selectors/behavior: `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- Read for authority model: `dashboard/src/features/channels/registry/wecom-ui-definition.ts`

- [ ] Render a mocked WeCom channel with plugin inventory and routing data.
- [ ] Navigate from dashboard shell into `Channels`, then open the WeCom channel detail.
- [ ] Assert the WeCom shell nav exists via the current `data-testid="wecom-shell-nav"` seam.
- [ ] Assert the visible secondary pages are exactly:
  - `Overview`
  - `Onboarding`
  - `Access`
- [ ] Assert the following do not appear in the WeCom secondary nav:
  - `Settings`
  - `Diagnostics`
  - `Capabilities`
  - `Bindings`
  - `Analytics`
- [ ] Assert the legacy-host behavior remains correct:
  - `Overview` resolves through status host
  - `Access` resolves through access host

### Task 4: Cover `Open Access` handoff and Access editing path

**Files:**

- Create: `dashboard/e2e/wecom-channel-journey.spec.ts`
- Read for operator behavior: `dashboard/src/components/panels/channels/ChannelAccessTab.tsx`
- Read for summary handoff: `dashboard/src/components/panels/channels/WecomOverviewPage.tsx`

- [ ] Stub a WeCom account state that shows permission summary and an actionable access entry.
- [ ] Assert clicking `Open Access` from the overview/status-side summary lands on the Access page.
- [ ] Assert account selection is preserved when the handoff includes an account id.
- [ ] Edit one Access-owned control in E2E and capture the outgoing patch payload.
- [ ] Assert the request hits `/api/config/patch`.
- [ ] Assert the patch is narrow and targets WeCom access-owned fields only, not generic settings spillover.

Minimum payloads to capture in this chunk:

- `allowFrom`
- DM policy
- dynamic-agent toggle or related access-owned field

### Task 5: Cover runtime truth vs inventory truth separation

**Files:**

- Create: `dashboard/e2e/wecom-channel-journey.spec.ts`
- Read for plugin handoff UI: `dashboard/src/components/panels/channels/ChannelDetail.tsx`

- [ ] Assert channel detail shows runtime-facing channel status and account summary.
- [ ] Assert the same view also shows plugin identity hints:
  - plugin id
  - origin
  - plugin config key
- [ ] Assert `Open Plugin` hands off into the Plugins inventory panel rather than mutating channel runtime state in place.
- [ ] Assert routing content remains summary/deep-link only and is not duplicated as an embedded editor inside the WeCom page shell.

---

## Chunk 3: Feishu wizard and plugin-metadata journey

This chunk is the main proof for Specs 2, 3, and 4.

### Task 6: Cover metadata-driven action bar and wizard entry

**Files:**

- Create: `dashboard/e2e/feishu-wizard-journey.spec.ts`
- Read for action behavior: `dashboard/src/components/panels/channels/CapabilityActionBar.tsx`
- Read for wizard loader behavior: `dashboard/src/components/panels/channels/wizard/wizard-spec-loader.tsx`

- [ ] Mock a Feishu plugin entry with:
  - `setupWizardSpec`
  - `deckActionCapabilities`
  - `locales`
- [ ] Open the Feishu channel detail.
- [ ] Assert the action bar renders from plugin metadata rather than a hardcoded channel branch.
- [ ] Assert the login or wizard-launch action opens the generic `ChannelWizardDialog`.
- [ ] Assert the dialog content comes from the plugin-provided wizard spec path.

### Task 7: Cover plugin locale and validation/probe behavior

**Files:**

- Create: `dashboard/e2e/feishu-wizard-journey.spec.ts`
- Read for validation behavior: `dashboard/src/components/panels/channels/wizard/WizardRunner.tsx`

- [ ] Use English locale for stable assertions.
- [ ] Provide plugin locale strings that differ from deck main locale strings so the test can prove plugin-locale merge is actually used.
- [ ] Walk the minimum Feishu wizard flow through the validation step.
- [ ] Capture and assert the validation request hits `/api/channels?probe=true`.
- [ ] If the action bar exposes test-message capability, capture and assert the non-wizard action hits `/api/channels/feishu/test`.
- [ ] Assert plugin inventory and channel detail stay consistent for the same Feishu plugin identity.

### Task 8: Cover graceful fallback when metadata is incomplete

**Files:**

- Create: `dashboard/e2e/feishu-wizard-journey.spec.ts`
- Create: `dashboard/e2e/generic-channel-fallback.spec.ts`

- [ ] Mock a plugin entry where wizard/action metadata is incomplete.
- [ ] Assert the UI renders `Not available in Deck yet` or equivalent incomplete-state copy instead of inventing a bogus action.
- [ ] Assert the fallback behavior does not turn a generic channel into a fake bespoke channel shell.

---

## Chunk 4: Generic fallback and authority takeover journey

This chunk is the direct proof for Spec 4 beyond WeCom.

### Task 9: Cover generic channel and schema-only fallback

**Files:**

- Create: `dashboard/e2e/generic-channel-fallback.spec.ts`
- Read for registry behavior: `dashboard/src/features/channels/registry/channel-ui-authority.ts`

- [ ] Mock one non-WeCom channel that should stay generic.
- [ ] Assert its channel detail does not render the WeCom page-shell nav.
- [ ] Assert the generic channel still shows the expected core surfaces through the current authority path.
- [ ] Add one schema-only or incomplete-inventory case and assert the detail view remains stable instead of crashing or showing bespoke-only affordances.

### Task 10: Cover no-hardcoded-id behavior at the user-journey level

**Files:**

- Create: `dashboard/e2e/generic-channel-fallback.spec.ts`

- [ ] Open at least two channels with different authority shapes in the same test file:
  - WeCom bespoke
  - Feishu metadata-driven generic-plus-wizard
  - one plain generic channel
- [ ] Assert the UI shape changes by mocked authority data, not by stale assumptions in the test harness.
- [ ] Do not assert implementation details from internal registry structures; assert only user-visible differences that correspond to authority outcomes.

---

## Chunk 5: Local Gateway live smoke

### Task 11: Extend the existing live smoke into channel/plugin surfaces

**Files:**

- Modify: `dashboard/e2e/live-smoke.spec.ts`
- Create: `dashboard/e2e/live-channels-smoke.spec.ts`

- [ ] Keep the existing dashboard boot test.
- [ ] Add a live test that opens:
  - `Channels`
  - `Plugins`
  - one available channel detail if any channels are present
- [ ] Assert these surfaces load against a real local Gateway without crashing.
- [ ] Keep assertions thin and environment-neutral.
- [ ] Skip channel-detail assertions gracefully if no channels exist in the local environment.

Local preflight for this chunk:

```bash
NO_PROXY=localhost,127.0.0.1 scripts/dev/deck-dev.sh gateway
cd dashboard
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 pnpm test:e2e e2e/live-smoke.spec.ts e2e/live-channels-smoke.spec.ts
```

Rules:

- Gateway must come from local source, not a globally installed `openclaw`.
- Reuse the existing token bootstrap logic from `live-smoke.spec.ts`.

---

## Chunk 6: Optional WeCom live smoke

### Task 12: Add a guarded non-destructive WeCom smoke

**Files:**

- Create: `dashboard/e2e/live-wecom-smoke.spec.ts`

- [ ] Gate the spec behind `PLAYWRIGHT_LIVE_WECOM=1`.
- [ ] Require an already-configured local WeCom environment; do not attempt setup in the test.
- [ ] Open the WeCom channel detail only if a WeCom channel is present.
- [ ] Assert:
  - WeCom shell nav appears
  - Access page opens
  - plugin handoff is present
- [ ] Optionally run a non-destructive probe/test action only if the current UI surface already exposes it and it is known to be safe.
- [ ] Do not mutate credentials, uninstall plugins, or trigger destructive logout flows in this lane.

Suggested command:

```bash
NO_PROXY=localhost,127.0.0.1 scripts/dev/deck-dev.sh
cd dashboard
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 PLAYWRIGHT_LIVE_WECOM=1 pnpm test:e2e e2e/live-wecom-smoke.spec.ts
```

---

## 3 Verification matrix

### PR gate

```bash
pnpm --dir dashboard test:e2e --grep @mock
```

### Local merge gate for this lane

```bash
pnpm --dir dashboard test:e2e --grep @mock
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 pnpm --dir dashboard test:e2e --grep @live
pnpm --dir dashboard build
```

### Optional operator validation

```bash
PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_LIVE_SMOKE=1 PLAYWRIGHT_LIVE_WECOM=1 pnpm --dir dashboard test:e2e --grep @live-wecom
```

Artifact expectations:

- traces retained on live failures
- screenshots on failure
- HTML report preserved for multi-step journey debugging

---

## 4 Risks and guardrails

- Do not collapse all coverage into live mode. That will be flaky and too environment-dependent.
- Do not add broad brittle selectors based on DOM order when a role or existing test id exists.
- Do not make WeCom E2E the default gate for contributors who do not have a configured WeCom environment.
- Do not overfit mocked payloads to internal implementation details that the real API does not promise.
- Keep the mocked lane aligned with current route shapes already used by dashboard stores:
  - `/api/channels`
  - `/api/deck/plugins`
  - `/api/deck/routing`
  - `/api/config/patch`
  - `/api/channels?probe=true`
  - `/api/channels/[channelId]/test`

---

## 5 Done criteria

- [ ] The five-spec recall is encoded into current corrected user journeys, not obsolete intermediate states.
- [ ] Mocked Playwright lane covers WeCom page-shell, Access handoff, Feishu wizard, metadata action bar, and generic fallback.
- [ ] Local live-smoke lane covers Channels and Plugins on a real local Gateway.
- [ ] Optional WeCom live smoke exists and is explicitly gated.
- [ ] New tests use semantic locators and web-first assertions.
- [ ] `pnpm --dir dashboard test:e2e --grep @mock` is green.
- [ ] `pnpm --dir dashboard build` is green after the E2E additions.
