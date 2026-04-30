## Context

`frontend-design-system-via-chat` shipped the design-system baseline (tokens + 36 atoms + 5 hooks) and migrated every chat surface to `--ds-*`. Theme.css audit passes with 2 documented exceptions (`.deck-ui-markdown` + `.deck-ui-sr-only`, both global a11y/typography utilities). 4 visual-regression PNGs are archived at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/deck-baseline/`.

Despite that, two open questions remain after the user's 2026-04-30 review:

1. **Bundle parity** — the chat surface aligns at the inspect level (palette + chrome + typography use bundle tokens), but specific bundle primitives are not yet present in deck-go JSX:
   - `right-panel.jsx` lines 911-922: `cp-iframe-mock` / `cp-iframe-bar` / `cp-iframe-content` decorative iframe skeleton, plus `cp-card` / `cp-card-h` / `cp-row` / `cp-actions` cards inside the canvas.
   - `right-panel.jsx` lines 950-989: `ap-html-stub` for the artifact HTML fallback view, plus the active-tab accent border on `.ap-tab.active`.
   - `composer.jsx` lines 685-712: `composer-icon-btn.active` toggled state for the icon-button row, plus the `cmd-tag` slash-command tag with close affordance.

2. **Cross-module readiness** — the next migration targets are 5 panels (Settings / Models / Channels / Sessions / Logs), each rendering legacy `deckgo-*` chrome. Without an explicit atom × panel matrix, panel teams have no signal whether the design system is ready for them or whether they will trigger backwards-incompatible atom changes.

This change addresses both with one verification protocol per goal, plus the visual remediation work needed to close the gaps the protocols surface.

## Goals / Non-Goals

**Goals:**

- Close the three bundle-parity gaps (canvas / artifact / composer) so chat truly reproduces Claude Design at the JSX-structure level, not just at the token level.
- Codify a class-by-class diff procedure between deck-go chat JSX and bundle JSX so future chat changes have a parity gate.
- Codify the cross-module readiness audit format so panel migrations have a known-good gate.
- Ship axe automation across the 36 atoms (small `vitest-axe` devDep, project-wide a11y regression net).
- Run user-driven Lighthouse + keyboard walkthrough on the post-remediation chat surface.
- Refresh the 4 deck-baseline PNGs so future P3+ visual diffs anchor on the post-parity state.

**Non-Goals:**

- **No backend / Gateway / contract changes.** Visual + verification work only.
- **No atom re-architecture.** New atoms can be added; existing atoms must not change their public API.
- **No theme.css migration of `.deck-ui-markdown` / `.deck-ui-sr-only`.** These remain dual-class (per the previous proposal's documented exceptions).
- **Not yet migrating non-chat panels.** This change produces the readiness matrix; actual panel migrations are downstream proposals.
- **No new runtime npm dependencies.** Only `vitest-axe` (devDep).

## Decisions

### D1: Per-surface remediation order — composer → artifact → canvas

**Why:** Composer is the highest-touch surface (every session uses it) and the bundle changes there (icon-button active state + cmd-tag chip) are the smallest. Artifact panel is medium-traffic (only when an artifact is open) but the `ap-html-stub` is an easy win. Canvas is the most architectural change (`cp-iframe-mock` + `cp-card` introduce new sub-components) and benefits from being last so we have the parity-gap-report.md fully written by then.

**Alternative considered:** canvas first (highest visual mismatch) — rejected because it would require us to define new sub-components (`CpCard`, `CpIframeMock`) before establishing the parity-report format, increasing the risk of premature abstraction.

### D2: Parity report is a documented artifact, not a JSON contract

**Why:** The bundle JSX is 2094 LOC of decorative React; many divergences will be intentional (e.g., deck-go renders `<Card surface="flat">` for a `<div className="cp-card">` because the Card atom owns the chrome). A free-form `chat-parity-gap-report.md` lets us record the divergence + justification per gap. A JSON schema would force false-positive entries for every justified divergence.

**Alternative considered:** JSON output checked by a CI script — rejected because the bundle JSX is not stable (it's a one-shot prototype). Future bundle iterations would invalidate the schema; markdown gracefully ages.

### D3: Cross-module readiness matrix as `panel × atom × status` table

**Why:** A single rectangle of (panel rows × atom columns) makes "atoms applied", "atoms missing", and "atoms needing extension" instantly visible. Each cell can carry a one-line note (e.g., "Card atom — needs `surface=warning` variant for alert panel header").

**Alternative considered:** per-panel narrative reports — rejected because they obscure cross-cutting "this atom is missing in 3 of 5 panels" patterns.

### D4: axe automation via `vitest-axe`, not a custom matcher

**Why:** `vitest-axe` is a 200KB devDep that wraps `@axe-core/react`'s rule engine and provides a `toHaveNoViolations()` matcher. Implementing this in-house would mean re-implementing the axe rule registry and risk drift. The previous Non-Goal "no new npm deps" was scoped to the chat migration's hot path; this change explicitly opts in for verification tooling because the chat migration is no longer active and the foundation work needs the safety net.

**Alternative considered:** keep manual aria assertions only — rejected because manual coverage is ~70% of axe rules and visual a11y bugs (contrast, landmark order, tab-vs-visual mismatches) escape it.

### D5: Visual remediation lands per-atom commit (3 commits), not bundled

**Why:** The previous proposal's per-atom workflow (commit per visual replacement) was the smoothest reviewable cadence. Continuing that pattern here keeps every gauntlet (tsc + vitest + axe + build) green between atoms, so any regression is bisectable.

## Risks / Trade-offs

- **[Bundle JSX is a prototype, not source-of-truth]** → The bundle was shipped as a one-shot Claude Design pilot; future iterations may diverge. Mitigation: lock the parity gate to the **2026-04-29 bundle hash** captured in the gap report; new bundles would require a new audit cycle.
- **[axe automation may surface contrast bugs in `--ds-*` light theme]** → The light theme tokens were not re-verified for AA contrast in the previous proposal. Mitigation: if axe surfaces light-theme violations, fix the offending tokens (additive change to `tokens/index.css`) — does not require atom re-architecture.
- **[Cross-module audit may surface "missing atom X" required for 3+ panels]** → That blocks the panel migrations. Mitigation: the matrix has a clear "needs new atom X" column; each missing atom becomes a small follow-up change, not blocking this one.
- **[Visual remediation may break existing chat behavioral tests]** → Adding `CpCard` sub-components inside CanvasPanel changes the DOM structure. Mitigation: every atom commit runs the full vitest gauntlet; chat behavioral tests live separately and are 840+ assertions strong.
- **[Lighthouse score < 95]** → If the user-driven Lighthouse run fails, we have to remediate before close. Mitigation: gate the close on Lighthouse pass; if it fails, treat each violation as a follow-up sub-task rather than re-opening axe-style automation gaps.

## Migration Plan

This change has no production migration. The work is layered:

1. **Verification artifacts first** (parity report + readiness matrix). These are pure docs; no code changes.
2. **Visual remediation** (3 commits, one per atom). Each commit is a normal atom-style port (CSS + JSX + unit tests + screenshot refresh).
3. **axe automation** (1 commit). devDep added via `pnpm add -D vitest-axe`; assertions added incrementally to atom test files.
4. **Lighthouse + keyboard walkthrough** (user-driven, recorded in tasks.md).
5. **Refresh visual baselines** (4 PNG re-capture).

Rollback strategy: each atom remediation commit is independently revertable. axe automation is opt-in via the matcher; if it surfaces too many false positives the matcher can be relaxed without touching atom code.

## Open Questions

- **Q1**: Do we want to capture bundle JSX rendered in a side-by-side iframe for the parity report, or is per-gap screenshot-pair sufficient? Decision deferred to first parity-report artifact iteration; default to screenshot pairs unless rendering bundle JSX is trivial.
- **Q2**: Should the readiness matrix include a "deprecated atoms / tokens" column for things the legacy `deckgo-*` panels use that have no atom equivalent (e.g., specific chart colors)? Decision: yes, but as a footnote per panel rather than a separate column, to keep the matrix readable.
