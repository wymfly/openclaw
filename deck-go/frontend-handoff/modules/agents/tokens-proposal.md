# agents — tokens-proposal

> Tokens this module needs that are **not** yet in `frontend-handoff/design-system/tokens.css`. Designed to be additive — none of these conflict with existing tokens.

Status: **proposal** — promote to canonical only after second module (routing/subagents/activity) needs them.

## New semantic tokens

```css
/* Status dot — used in agent rows + detail header.
   Routing module will reuse for route enabled/disabled state.
   Activity module will reuse for stream connected/disconnected.
   Promote when 2nd consumer arrives. */
--ds-status-idle: var(--ds-text-3);
--ds-status-busy: var(--ds-success);
--ds-status-error: var(--ds-danger);

/* Danger surface — used in Overview > Danger zone card.
   Subagents module's "remove permitted delegate" UI may reuse. */
--ds-danger-surface: rgba(239, 102, 96, 0.04);
--ds-danger-surface-border: var(--ds-danger);

/* Code block — used in System prompt preview.
   Future preview UIs in routing (path patterns) may reuse. */
--ds-code-bg: var(--ds-bg-0);
--ds-code-text: var(--ds-text-2);
--ds-code-accent: var(--ds-accent); /* for section headings inside codeblock */

/* Pulse animation timing — used by busy dot.
   Activity module uses for stream-active indicator. */
--ds-anim-pulse: 1.6s;
--ds-anim-pulse-fn: cubic-bezier(0.4, 0, 0.6, 1);
```

## Light-theme overrides

```css
html[data-theme="light"] {
  --ds-danger-surface: rgba(220, 70, 70, 0.06);
  --ds-code-bg: #f7f5f0;
}
```

## Why not promote now?

Per `frontend-handoff/CLAUDE.md` §promotion, an atom/token is promoted **after a second consumer** validates it. These tokens are baked into the agents prototype as inline CSS variables — when routing or subagents lands, we lift them to canonical and update both modules.

## What this module deliberately does NOT propose

- **No new color hue** — status dots use existing `--ds-success` / `--ds-danger`. Adding a new "busy purple" or similar would expand the palette without justification.
- **No new font scale** — all sizes use existing `--ds-text-*`.
- **No new radii** — existing `--ds-radius-*` covers all cards / pills / dots.
- **No new spacing token** — all spacing uses existing `--ds-space-*`.
