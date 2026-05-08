# Frontend Data Fabric

`src/data` is the server-state layer for `frontend-new`.

- BFF endpoints and Gateway RPC calls stay separate. Browser Gateway RPC calls
  still go through deck-go backend adapters.
- Query keys live in `contracts/query-keys.ts`; freshness policy lives in
  `contracts/freshness.ts`.
- Mutations default to `retry: false`. Offline write replay, IndexedDB
  persistence, custom lint enforcement, and generated projection patch fields
  are deferred until a later OpenSpec change explicitly adds them.
- UI state such as selected rows, filters, tabs, form drafts, and expanded
  sections remains in React state or UI stores, not TanStack Query.
- Panel and shared-shell server reads use Data Fabric hooks, query option
  factories, or mutation wrappers. New direct `fetch*` facade imports, direct
  `fetch*()` helper calls, `deckFetch` calls, or store-owned
  `fetch*/load*/refresh*` server lifecycle methods are out of policy unless
  listed in `governance/exceptions.ts`.
- The exception registry is intentionally narrow and code-tested. It documents
  specialized Chat stream/command/history seams and the Approvals stream/UI
  bridge; ordinary panel first-load and background refresh code must not copy
  those patterns.
- DevTools, prefetch, IndexedDB persistence, offline mutation queues, automatic
  mutation retry, and generated live-projection patch fields remain deferred.
