# Agents Prototype Reflowback Candidates

> **Date:** 2026-05-04
> **Source change:** `deck-go-frontend-foundation-readiness`
> **Source pilot:** `frontend-handoff/modules/agents/` (high-fidelity prototype, 2026-05-03 — 2026-05-04)
> **Status:** **Recorded — NOT yet promoted.** Awaiting second-panel signal.

---

## Why this file exists

The agents prototype (committed to `frontend-handoff/modules/agents/`) introduced four panel-local molecules whose shapes look reusable but appear in only one module today. Per the design system feedback loop ("≥2 modules + reuse analysis before promotion"), they stay panel-local until a second prototype demonstrates the same shape.

This document is the parking lot. When channels / models / sessions / etc. exhibit the same shape, file a follow-up proposal naming both call sites and proposing a single canonical API.

---

## Candidate 1: `Avatar`

**Shape:**

- 34px / 44px square with rounded corners
- Renders an emoji, an initial letter, or an image URL
- Optional `accent` variant: gradient background + accent border, used for the "default agent" treatment

**Current location:**

- `agents/list-view.jsx` `.agent-row__avatar` (34px, accent on default)
- `agents/detail-view.jsx` `.detail-identity__avatar` (44px hero variant, accent on default)

**Why panel-local for now:**

- Only agents has identity-with-emoji-or-initial pattern today
- Channels / sessions / threads will likely need similar identity affordances → second-signal candidate
- API shape is non-trivial (emoji vs initial vs image fallback), needs ≥2 call sites to converge

**Promotion criterion:**

- A second module ships an avatar-like surface with the same emoji-or-initial-or-image fallback chain
- Then propose `Avatar` as a canonical atom (likely lives in `atoms/Avatar.tsx`)

---

## Candidate 2: `ListRow`

**Shape:**

- A clickable row card with: leading avatar, primary identity (name + tags), secondary metadata (mono-font triple separated by " · "), trailing right-aligned counts + status pill
- Hover / focus / selected states with subtle background and border-color shifts
- Used for searchable / filterable / sortable lists

**Current location:**

- `agents/list-view.jsx` `.agent-row` (whole component)

**Why panel-local for now:**

- Single-panel signal; channels / models / plugins / sessions are highly likely to use the same shape but not implemented yet
- Composition decision pending: should this be a flat atom, or a pattern that takes slot-children for avatar/main/right?
- Risk of premature lock-in if API isn't validated by ≥1 more panel

**Promotion criterion:**

- Channels and / or models prototype use the same row anatomy
- At promotion time, decide between: (a) atom `ListRow` with strict slot props, or (b) pattern `ListShell` that wraps any row content

---

## Candidate 3: `StatusPill`

**Shape:**

- Pill-shaped badge with leading colored dot + label
- Tones: `idle` (success-bg) / `busy` (accent-bg with pulse animation) / `error` (error-bg) / `offline` (neutral)
- Pulse keyframe animation only on `busy` tone, scale 0.5→1.4, opacity 0.4→0, 1.6s loop

**Current location:**

- `agents/styles.css` `.pill / .pill__dot` + `pulse` keyframes
- `agents/list-view.jsx` and `agents/detail-view.jsx` consume the same class

**Why panel-local for now:**

- Tones are agent-status specific (`busy / idle / error / offline`) — generalizing them needs broader vocabulary
- The pulse animation is a unique design choice that should be intentional, not accidentally inherited
- Existing `Badge` atom already covers "static colored chip"; promoting StatusPill must justify why it's not just `Badge variant="busy"` with an animated dot

**Promotion criterion:**

- A second module ships a similar live-status indicator (sessions running state? webhooks delivery state? cron next-run countdown?)
- At promotion time, evaluate: is this an extension of `Badge` (add `dot` prop + `tone="live"` variant) or a new atom?

---

## Candidate 4: `FileRow`

**Shape:**

- Compact row with leading file icon, file name (mono font), trailing size badge
- Hover / active state for selection in a file-browser sidebar
- Click handler opens the file content into a paired editor

**Current location:**

- `agents/detail-view.jsx` `.file-row` (inside Files section)

**Why panel-local for now:**

- Files-as-list is currently agents-specific; only Files section uses it
- API surface (size formatting, active selection) needs to be validated by another browser-style surface

**Promotion criterion:**

- A second module needs a file-browser sidebar (e.g., docs panel viewing project docs, or sessions panel viewing transcript exports)
- At promotion time, evaluate whether to add as canonical atom or compose from existing primitives (Card + IconFile + mono Tag)

---

## Out-of-scope (do NOT promote)

- `KbdHint` / `EmptyState` / `SectionHeader` / `PageShell` — already promoted to canonical patterns in this same change (`deck-go-frontend-foundation-readiness`). They graduated because they had cross-module signals from the start (every panel shell needs them).

---

## How to promote a candidate later

1. Identify the second panel exhibiting the same shape (in `frontend-handoff/modules/<x>/` or `frontend-new/src/components/panels/<x>/`)
2. File `frontend-handoff/design-system/proposals/<YYYY-MM-DD>-promote-<candidate>.md` containing:
   - Both call sites linked
   - Proposed API (props, slots, variants)
   - Reuse analysis: closest existing atom/molecule and why extending it is impossible
   - Migration plan for the existing call sites
3. Open a separate OpenSpec change (e.g., `deck-go-promote-list-row-pattern`)
4. Engineering owner (Claude Code on `frontend-new/`) approves and lands

This file is the **input** to that promotion change. It is **not** itself a promotion.
