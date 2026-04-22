# Deck Go Stage 2 Cutover Plan

## Purpose

Define how Stage 1 and Stage 2 coexist without dual backend truth while Stage 2
is being introduced.

## Rule

At any point in a given environment, one runtime-facing backend owner is
canonical for a given slice.

## Initial Retirement / Migration Targets

| Current Stage 1 seam | Stage 2 action |
| --- | --- |
| `deck-go/frontend-next/server/runtime.ts` | retire after `controld` owns runtime adaptation |
| `deck-go/frontend-next/src/app/api/_deck-go-proxy.ts` | keep only as temporary cutover aid, then retire |
| `deck-go/frontend-next/src/app/api/activity/route.ts` | replace with Stage 2 query contract |
| `deck-go/frontend-next/src/app/api/monitor/runs/route.ts` | replace with Stage 2 query contract |
| `deck-go/frontend-next/src/app/api/monitor/runs/[runId]/route.ts` | replace with Stage 2 query contract |
| `deck-go/frontend-next/src/app/api/monitor/stats/route.ts` | replace with Stage 2 query contract |

## Cutover Sequence

### Step 1 — Introduce `controld` successor entrypoint

- add a Stage 2 successor entrypoint inside the current backend tree
- do not introduce a second long-lived runtime-adapter backend

### Step 2 — Move runtime adaptation first

- connection lifecycle
- capability handshake
- runtime event intake
- canonical event emission

### Step 3 — Move projection/query slices

- runtime summary
- session list
- session timeline snapshot
- monitor/activity summaries
- canvas summary

### Step 4 — Move UI host

- React + Vite host consumes Stage 2 query/command/realtime contracts
- Stage 1 `frontend-next` becomes reference/fallback only until retirement

### Step 5 — Retire transitional seams

- remove Next-host runtime adapter
- remove remaining local fallback query handlers
- leave only explicit compatibility seams that are still intentionally retained

## Non-Goals

- big-bang switch of all runtime-facing behavior at once
- parallel long-term ownership of the same backend slice
