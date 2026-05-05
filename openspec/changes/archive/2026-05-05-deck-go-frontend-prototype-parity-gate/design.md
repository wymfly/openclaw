## Context

The current visual E2E files under `deck-go/test/e2e/*-visual.spec.ts` start a
mock Gateway/BFF/frontend stack, open a module, assert key text or interactions,
and save screenshots through `page.screenshot()`. This is useful functional
coverage but it is not a visual parity gate.

The 2026-05-05 audit also found three failing specs:

- `api-explorer`: the spec expects 3 methods while the mock Gateway now exposes
  4 methods including `gateway.batch`;
- `approvals`: the spec expects `Approvals ready`, but the E2E path does not
  find it before timeout;
- `logs`: the spec expects `Tail ready`, but the E2E path does not find it
  before timeout.

This child change stabilizes those deterministic issues and adds a lightweight
evidence generator that can be reused by later module remediation proposals.

## Goals / Non-Goals

**Goals:**

- Produce repeatable prototype/current comparison artifacts from local files and
  Playwright screenshots.
- Keep the artifact format simple enough for every child proposal to use.
- Make current mock visual specs green when their expectations are stale or
  fixture-driven.
- Clearly label the output as evidence, not automatic visual approval.

**Non-Goals:**

- Do not perform module UI redesigns in this shared gate change.
- Do not add image-diff thresholds as the sole acceptance rule.
- Do not require real Gateway startup for this shared mock gate.

## Decisions

### D1: Use a script over embedding prototype comparison in every E2E spec

A small script can collect existing prototype screenshots, locate mock-current
screenshots, build contact sheets, and write a verdict skeleton. Module E2E specs
can remain focused on functional mock coverage.

Alternative considered: add `toHaveScreenshot` baselines to every visual spec.
Rejected because the current problem is prototype comparison and structured
review, not just screenshot regression against generated snapshots.

### D2: Keep pixel metrics auxiliary

The tooling may write pixel-diff metrics when dependencies already exist, but
the contact sheet and verdict are the primary review artifacts because dark UI
shared backgrounds can understate semantic layout drift.

Alternative considered: fail purely on pixel threshold. Rejected because early
module remediation needs human/structured judgment and accepted exceptions.

### D3: Fix stale visual specs at their source

If an E2E spec fails because the mock Gateway contract changed, update the spec
or fixture to match contract truth. If it fails because UI text changed but the
state is otherwise valid, update the assertion to a stable state indicator. If
it fails because data is missing, fix the mock fixture.

Alternative considered: skip failing specs in the shared gate. Rejected because
that would weaken the baseline before module remediation begins.

## Risks / Trade-offs

- **Risk: Script becomes another weak proxy.** -> It produces evidence artifacts
  and verdict skeletons; child proposals still need structured verdicts.
- **Risk: Fixing failing specs reveals real UI bugs.** -> Fix deterministic bugs
  inside this change only when they are narrow fixture/assertion/state defects;
  larger visual redesign remains for module child proposals.
- **Risk: Contact-sheet generation depends on existing mock screenshot names.**
  -> Keep the module-to-primary-screenshot mapping explicit and reviewable.

## Migration Plan

1. Add the parity evidence script and default module mapping.
2. Repair the three currently failing mock visual specs.
3. Run focused failing specs, then the full mock visual suite.
4. Generate prototype/current contact sheets and verdict skeleton.
5. Update remediation docs and head task progress.
