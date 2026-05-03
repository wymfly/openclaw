# Implementation Notes

## Production divergences

- The production panel keeps the handoff's relationship workspace but uses the
  existing `fetchThreads()` wrapper, shared Deck navigation helpers, and i18n
  provider directly instead of introducing new state or table abstractions.
- The production UI does not add a persistent in-app mock-only banner. Mock-only
  labeling is carried by the E2E name, screenshot artifacts, OpenSpec closeout,
  and readiness record.

## Deterministic drift fixed

- The bundled mock Gateway did not implement `deck.threads.list`, so the
  frontend could not exercise `GET /api/deck/threads` through the normal BFF
  path in mock visual E2E. This change adds contract-shaped thread bindings and
  deterministic `agentId`, `channel`, and `status` filtering.

## Design-system feedback

- No canonical atom, token, dependency, or pattern was introduced.
- Thread metric tiles, inventory rows, relationship map nodes, handoff action
  strips, and payload disclosures remain module-local.
- Relationship map nodes are a watch item for a future shared pattern after
  Threads, Subagents, Sessions, and Routing settle on a common API.

## Remaining follow-up

- Real Gateway currently projects persisted Discord thread bindings. Non-Discord
  thread semantics remain uncertain and should not be inferred from mock data.
- The `status` filter is contract-shaped, but real inactive/archive semantics
  are not exposed as a row field yet.
