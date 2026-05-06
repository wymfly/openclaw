## Context

Current list facades build query strings independently. Examples include numeric cursor log tailing, string cursor monitor runs, offset-based cron lists, bounded activity/audit lists, date-bounded usage lists, docs `q` search, and sessions `search`/`activeMinutes`. These are all legitimate product adaptations over Gateway/BFF support, but the semantics are not described in one place.

## Goals / Non-Goals

**Goals:**

- Create a source contract that lets frontend and backend contributors see list semantics before building a panel.
- Validate referenced endpoints and response DTO fields against existing contract sources where practical.
- Generate frontend metadata and a small helper for consistent query serialization.
- Refactor current high-traffic frontend list builders to use the helper without changing wire parameter names.

**Non-Goals:**

- Do not force every endpoint into one pagination model.
- Do not add server-side pagination where the current BFF only supports bounded reads.
- Do not rename existing query parameters in this proposal.
- Do not solve module-specific data completeness; module completion proposals handle that.

## Decisions

1. **Represent modes explicitly rather than normalizing them away.**

   The contract supports `cursor`, `offset`, `bounded`, and `filter-only` modes because the current BFF intentionally has mixed sources. A false uniform abstraction would hide important Gateway truth.

2. **Use canonical parameter kinds with endpoint-specific wire names.**

   The product-level names are `limit`, `cursor`, `offset`, `search`, `sort`, `filter`, and `dateRange`; the contract records the actual wire parameter (`q`, `search`, `startDate`, `since`, etc.) so current API compatibility is preserved.

3. **Generate frontend metadata but keep DTO changes minimal.**

   This child establishes governance and shared serialization first. Response envelope tightening is left to later module completion proposals when the exact product view needs are known.

## Risks / Trade-offs

- **Risk:** A contract row may document a list endpoint whose backend implementation still ignores a parameter.  
  **Mitigation:** The contract records only parameters that current facade/backend code passes or reads; module completion proposals can add deeper real E2E proof.

- **Risk:** Migrating all query builders at once could create broad behavior drift.  
  **Mitigation:** The helper serializes existing names and only skips empty/non-finite values, matching current facade behavior.

- **Risk:** Existing tests may assert exact URL order.  
  **Mitigation:** The helper preserves contract field order and tests cover representative URLs.
