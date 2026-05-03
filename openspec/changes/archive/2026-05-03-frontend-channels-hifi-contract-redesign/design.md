## Context

`frontend-new` already has a functional `ChannelsPanel` with channel inventory, status badges, account diagnostics, selected-channel metadata, plugin navigation, probe testing, logout, enable/disable patching, throughput buckets, generic channel settings, account DM policy editing, WeCom access controls, and WeCom routing summary. Browser code stays behind the Deck API facade.

The current UI still depends on old `deck-ui-channels` global styling and shared shell components. Channels is more product/config heavy than sessions because it combines provider inventory, account-specific health, throughput telemetry, generic config editing, WeCom-specific access policy, and routing navigation in one panel.

Exploration found the current contract boundaries are BFF-shaped:

- Channel status uses `DeckGoChannelsStatusResponse` from `GET /channels`.
- Probe testing is a BFF projection over `channels.status?probe=true`.
- Throughput is currently a BFF endpoint with generated DTOs but mock/real data may be sparse.
- Generic channel patching goes through config get/patch server logic, not direct browser config edits.
- WeCom access controls use deck config read/patch and routing summary wrappers.

## Goals / Non-Goals

**Goals:**

- Produce a complete channels handoff package.
- Rewrite channels into a high-fidelity channel operations workbench aligned with the settled design system.
- Preserve current channel inventory, selection, diagnostics, throughput, probe, logout, patch, WeCom access, and routing behavior.
- Add contract-shaped mock visual coverage for the ready workbench and at least one interaction state.
- Record channel-specific design-system feedback without promoting atoms in this module change.

**Non-Goals:**

- No real Gateway/LLM E2E.
- No new channel provider configuration schema.
- No change to WeCom access semantics.
- No direct Gateway RPC from browser code.
- No new dependencies.
- No design-system atom promotion inside this module change.

## Decisions

1. **Treat Channels as a two-region operations workbench with embedded access detail.**
   The UI should expose inventory and selected-channel operations as distinct regions. WeCom access can remain an embedded selected-detail section because its APIs are channel-scoped.

2. **Keep all data through existing API wrappers.**
   `fetchChannels`, `testChannel`, `fetchChannelThroughput`, `logoutChannel`, `patchChannelConfig`, config wrappers, routing wrappers, and navigation helpers remain the production boundary.

3. **Fix only deterministic fixture/API drift.**
   The bundled mock Gateway currently lacks `channels.status` and `channels.logout`; if visual E2E needs them, add contract-shaped fixtures. Uncertain provider semantics become handoff follow-up.

4. **Keep destructive or state-changing actions guarded.**
   Logout and enable/disable currently use confirmation prompts. The visual rewrite can restyle them but must keep a confirmation gate unless tests and handoff define a safer replacement.

5. **Keep channel molecules local.**
   Candidate shared patterns include metric tile, channel row, diagnostic card, throughput row, config patch result seam, account policy row, WeCom access row, and routing handoff strip. They remain local until a dedicated design-system proposal defines stable APIs.

## Risks / Trade-offs

- **Risk: Behavior regression through a visual rewrite.** -> Preserve focused unit tests for inventory, navigation params, probe, logout, patch, WeCom access, and routing handoff.
- **Risk: WeCom-specific UI dominates generic channels.** -> Keep WeCom in selected-detail sections and make generic channel health first.
- **Risk: Mock data hides real Gateway gaps.** -> Label visual E2E as mock-only and record uncertain contract gaps in handoff notes.
- **Risk: Shared legacy shell components constrain fidelity.** -> Use design-system atoms where straightforward and keep remaining channel-specific rows local for this pass.
- **Risk: Large module diff.** -> Keep the change inside `panels/channels/`, module-local CSS, mock fixture, E2E, handoff, and readiness docs.
