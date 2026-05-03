## Context

`frontend-new` already has a functional `SubagentsPanel` with active/history/config tabs, polling, run filters, lineage loading, steering, kill confirmation, per-agent permissions, and global `agents.defaults.subagents` config editing. Its data boundary is the existing API facade: `GET /deck/subagents`, `POST /deck/subagents` action envelopes, `fetchAgentsList`, `fetchAgentSubagentConfig`, and config get/apply wrappers.

There is no `frontend-handoff/modules/subagents/` package. The current visual implementation is still based on the old `deck-ui-subagents` global style block, and it has not been revalidated against the new chat/agents/routing design-system posture. Exploration also found a deterministic backend drift: frontend `fetchSubagentRuns` sends `agentId`, but `backend/internal/server/inventory.go` does not forward `agentId` from `/deck/subagents` query parameters.

## Goals / Non-Goals

**Goals:**

- Produce a complete subagents handoff package.
- Rewrite the production subagents panel into a compact operations workbench aligned with chat/agents/routing.
- Preserve contract-backed workflows: list/filter runs, select run, load lineage, steer active run, kill active run, inspect payloads, edit global defaults, and open related agent/session surfaces.
- Fix the backend child-agent filter forwarding drift.
- Add mock visual coverage and update design-system readiness evidence.

**Non-Goals:**

- No real Gateway/LLM subagent E2E in this change.
- No generated contract edits unless source drift is discovered.
- No new dependencies.
- No UI that implies unsupported durable run graph search, live lineage streaming, per-node logs, or atomic global-default diff previews.

## Decisions

1. **Keep the existing API facade as the view boundary.**
   Production view code should continue calling wrapper functions instead of repeating endpoint/action strings. The deterministic `agentId` drift is fixed in the Go BFF, not by changing frontend semantics.

2. **Use a triage-and-detail workbench.**
   Subagents needs quick run triage and a detailed action surface. The redesign will use: top status/metric strip, left queue/config area, right selected run detail, lineage timeline, and action/result panels.

3. **Treat local run status/timeline visuals as design-system candidates, not immediate atoms.**
   Agents and routing already repeated metric tiles and detail hero. Subagents will provide the third data point, but promotion still belongs in a separate design-system proposal unless the implementation truly needs shared code now.

4. **Keep global defaults editing conservative.**
   Global subagent defaults are edited through config get/apply and base-hash semantics. This change should improve presentation and labels without broad config model changes.

## Risks / Trade-offs

- **Risk: Subagents UI remains too dense.** -> Mitigate with active/history/config modes and a selected-run detail hierarchy.
- **Risk: Polling causes visual instability.** -> Preserve existing polling behavior but keep row dimensions stable and selection sticky.
- **Risk: Local defaults editor implies more schema validation than exists.** -> Keep the current clamped frontend validation and show apply results without inventing Gateway schema feedback.
- **Risk: Mock visual coverage is mistaken for real Gateway proof.** -> Label E2E evidence as mock visual only.
