# routing - API discrepancy notes

This file records known differences between desirable product behavior and current contract/backend truth. The high-fidelity pass must follow current truth first.

## 1. Binding reorder action

- **Design desire:** A first-class `deck.routing.reorder` action with stable binding IDs and atomic ordering.
- **Current truth:** The frontend currently reorders by removing the selected binding and adding it at a new `position` with the fresh config hash.
- **Implementation rule:** Preserve remove-plus-add behavior and make mutation results visible enough for operators to understand the risk.

## 2. Conflict severity

- **Design desire:** Backend/Gateway returns severity, owner agent, and recommended resolution.
- **Current truth:** `DeckGoRoutingValidateResponse.conflicts` returns open conflict objects, while the current UI also has local advisory `detectConflicts()` for loaded bindings.
- **Implementation rule:** Treat local conflict markers as advisory. The validate action remains the contract-backed answer.

## 3. Simulation explanation

- **Design desire:** Each simulation tier explains why it matched, skipped, or failed.
- **Current truth:** `DeckGoRoutingSimulationTier` only has `tier`, `matched`, and `checked`.
- **Implementation rule:** Render compact tier status without inventing explanations.

## 4. Route history

- **Design desire:** A persistent history of prior simulation inputs and live route decisions.
- **Current truth:** Routing activity can be inferred from `fetchActivityEvents(20)`, and simulation state is local.
- **Implementation rule:** Show recent activity from existing activity events only; do not imply durable route history.

## 5. Binding pagination

- **Design desire:** Server-side paging, sort, and search.
- **Current truth:** `GET /deck/routing` only exposes optional `agentId`, `channel`, and `accountId` filters.
- **Implementation rule:** Keep filtering to current query fields and client-side presentation; no cursor UI.

## 6. Real Gateway E2E

- **Design desire:** Visual tests also prove real Gateway behavior.
- **Current truth:** This change is scoped to mock visual coverage.
- **Implementation rule:** Closeout must explicitly say mock visual E2E is not real Gateway/LLM verification.
