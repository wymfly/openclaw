## Context

`frontend-new` already contains a functional `ApprovalsPanel` under the `approvals` panel id. It calls Deck-facing wrappers for approval operations:

- `fetchApprovalsPolicy()` -> `GET /api/approvals/policy`
- `updateApprovalsPolicy(file, baseHash)` -> `PUT /api/approvals/policy`
- `fetchPendingApprovals()` -> `GET /api/approvals/pending`
- `resolveApproval(id, decision)` -> `POST /api/approvals`
- `fetchPluginApprovals()` -> `GET /api/approvals/plugins`
- `resolvePluginApproval(id, decision)` -> `POST /api/approvals/plugins`

The Go BFF routes are served by the managed runtime approval surface. `exec.approvals.get`, `exec.approvals.set`, `exec.approval.resolve`, and `plugin.approval.resolve` have generated typed coverage, while `exec.approval.list` and `plugin.approval.list` remain untyped upstream-schema exceptions tracked in the Deck contract exceptions file. Browser code must continue to call the Go BFF wrappers only.

The current panel covers pending exec approvals, plugin approvals, policy defaults, per-agent overrides, allowlist paths, policy JSON editing, decisions, navigation to agent/session, stream updates, and raw payload details. The main gap is visual convergence: it still uses global `deck-ui-approvals*` styling in `theme.css`, has a dense card-inherited layout, and does not yet have focused mock visual E2E for plugin queues, policy mutation, and action results.

## Goals / Non-Goals

**Goals:**

- Produce a complete Approvals handoff package.
- Rewrite Approvals into a high-fidelity security operations workbench aligned with the current design-system posture.
- Preserve load/error handling, selection fallback, exec/plugin surface switching, decision behavior, policy editing, base-hash save behavior, stream updates, and raw evidence.
- Add focused mock/local visual coverage by seeding approval and plugin approval data through the normal backend route and mock Gateway fixture.
- Record Approvals-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, real upstream protocol change, or browser-side direct Gateway call.
- No approval security model redesign, policy grammar redesign, multi-step approval workflow, or signature/authentication redesign.
- No new dependency, table library, date library, JSON editor, or chart library.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee that real Gateway approval queue semantics are fully covered; mock/local visual coverage may use fixture data and is not full production security assurance.

## Decisions

1. **Treat Approvals as a security operations workbench, not a policy schema IDE.**
   The panel should expose pending approvals, plugin approvals, policy defaults, overrides, allowlist paths, and raw evidence. Full policy schema authoring or validation UX would expand product scope and belongs in a separate proposal.

2. **Preserve the Deck BFF contract boundary.**
   The frontend already respects the browser/backend boundary. The rewrite should keep the same wrapper calls and not introduce direct Gateway RPC or localstore access from browser code.

3. **Use module-local approval/policy molecules.**
   Queue rows, decision action groups, policy default controls, allowlist rows, stream status, and raw evidence overlap with prior workbench patterns, but Approvals adds security-sensitive semantics. Promotion to design-system patterns waits for a separate proposal.

4. **Fix deterministic mock Gateway gaps only as needed for visual coverage.**
   The current mock Gateway covers `exec.approvals.get` and `exec.approval.list`, but focused Approvals visual E2E also needs deterministic plugin approval list/resolve, exec resolve, and policy set responses. Any fixture change should stay contract-shaped and limited to the mock visual surface.

5. **Keep raw policy/action evidence visible but secondary.**
   Policy payload, selected approval payload, selected plugin approval payload, and last action result stay inspectable through `JsonDetails`, while the primary viewport prioritizes approval risk, queue state, decision actions, and policy edit affordances.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses security-sensitive decisions.** -> Keep focused unit tests for load/select/decide/plugin-decide/policy save/stream behavior and add visual E2E for ready plus interaction states.
- **Risk: Mock approval data overstates real Gateway coverage.** -> Label evidence as mock/local visual coverage and keep upstream-schema exceptions documented for untyped list methods.
- **Risk: Policy controls become too dense.** -> Use compact control groups with stable wrapping and keep raw JSON as a secondary editor.
- **Risk: Global CSS cleanup affects adjacent Automate panels.** -> Remove only `deck-ui-approvals*` styling from `theme.css`; leave `skills`, `budget`, and `alerts` shared styles intact until their own module passes.
