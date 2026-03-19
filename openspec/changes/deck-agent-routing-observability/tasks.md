## 1. Backend Infrastructure

- [ ] 1.1 Create `src/gateway/server-methods/deck/` directory with `index.ts` registration entry point
- [ ] 1.2 Implement content-hash binding ID utility (`sha256(JSON.stringify(normalizedMatch)).slice(0, 12)`)
- [ ] 1.3 Implement shared baseHash validation helper for all `deck.*` write RPCs

## 2. Backend: deck.routing.\* (5 RPCs)

- [ ] 2.1 Implement `deck.routing.list` — read config.bindings, compute tier, assign content-hash IDs, return with configHash
- [ ] 2.2 Implement `deck.routing.add` — atomic config.bindings append with baseHash lock and conflict/overlap detection
- [ ] 2.3 Implement `deck.routing.remove` — match by content-hash ID, atomic removal with baseHash lock
- [ ] 2.4 Implement `deck.routing.validate` — call existing matchesBindingScope + conflict detection, return tier and conflicts
- [ ] 2.5 Implement `deck.routing.simulate` — call resolveAgentRoute(), wrap 8-tier check details
- [ ] 2.6 Write tests for all deck.routing.\* methods

## 3. Backend: deck.agents.\* (5 RPCs)

- [ ] 3.1 Implement `deck.agents.detail` — aggregate agent config, binding count, session count, active subagent count, skill mode, effective skills
- [ ] 3.2 Implement `deck.agents.skills.get` — read agent.skills, build available list with runtime eligibility from skills.status
- [ ] 3.3 Implement `deck.agents.skills.set` — write agent.skills field with baseHash lock
- [ ] 3.4 Implement `deck.agents.subagents.get` — read agent.subagents, resolve effective defaults from agents.defaults.subagents
- [ ] 3.5 Implement `deck.agents.subagents.set` — write allowAgents + model only, with baseHash lock
- [ ] 3.6 Write tests for all deck.agents.\* methods

## 4. Backend: deck.subagents.\* (3 RPCs)

- [ ] 4.1 Implement `deck.subagents.list` — read subagentRuns Map + disk, filter by status/agentId/requesterAgentId, paginate
- [ ] 4.2 Implement `deck.subagents.kill` — call existing kill/termination logic
- [ ] 4.3 Implement `deck.subagents.lineage` — walk upward to root via requesterSessionKey, then collect full descendant tree, reconstruct parentRunId
- [ ] 4.4 Write tests for all deck.subagents.\* methods

## 5. Backend: deck.identity._ + deck.threads._ (4 RPCs)

- [ ] 5.1 Implement `deck.identity.list` — read config.identityLinks, split "channel:peerId" into structured fields
- [ ] 5.2 Implement `deck.identity.link` / `deck.identity.unlink` — append/remove "channel:peerId" with baseHash lock
- [ ] 5.3 Implement `deck.threads.list` — read Discord thread-bindings persistence files, filter by agentId/channel/status
- [ ] 5.4 Write tests for identity and threads methods

## 6. Frontend: Shared Components

- [ ] 6.1 Create `AgentBadge` component — agent emoji + name + clickable link to detail
- [ ] 6.2 Create `TierBadge` component — priority tier label with color coding
- [ ] 6.3 Create `SessionKeyDisplay` component — parse and highlight session key segments
- [ ] 6.4 Create `BindingDialog` component — add/edit dialog with channel-specific dynamic fields, real-time validation via deck.routing.validate, prefill support
- [ ] 6.5 Create `LineageTree` component — pure CSS flexbox tree with status icons
- [ ] 6.6 Create `SubagentRunCard` component — run info card with elapsed time, actions

## 7. Frontend: Zustand Stores

- [ ] 7.1 Create `deck-routing` store — fetchBindings, addBinding, removeBinding, validateBinding, simulate, configHash tracking
- [ ] 7.2 Create `deck-subagents` store — fetchActive, fetchHistory, fetchLineage, killRun, visibility-gated polling (5s, pause on document.hidden)
- [ ] 7.3 Create `deck-agents` store — fetchDetail, updateSkills, updateSubagents, detail cache with 60s TTL

## 8. Frontend: Routing Panel (New)

- [ ] 8.1 Create `RoutingPanel` with left-right split layout (responsive: stacked <1280px)
- [ ] 8.2 Implement `BindingTable` — sorted by tier, channel/agent filters, Default row fixed at bottom, DM scope display
- [ ] 8.3 Implement `RouteSimulator` — input form with dynamic channel-specific fields, simulate button, 8-tier results display
- [ ] 8.4 Register Routing panel in NavRail (CORE group, between Agents and Gateway)
- [ ] 8.5 Add i18n keys for routing panel (zh-CN + en)

## 9. Frontend: Agents Panel Enhancement

- [ ] 9.1 Refactor AgentsPanel to Master-Detail layout (left list 240px + right detail)
- [ ] 9.2 Implement `AgentList` — agent items with emoji/name/default badge, selected state
- [ ] 9.3 Implement `AgentDetail` container with 5 tabs
- [ ] 9.4 Implement `OverviewTab` — basic info + 5 stat cards (binding count, skills, subagent permissions, sessions, active runs)
- [ ] 9.5 Implement `RoutingTab` — agent-filtered binding table + add binding with prefilled agentId
- [ ] 9.6 Implement `SkillsTab` — mode switcher (all/whitelist) + skill checklist with eligibility status
- [ ] 9.7 Implement `SubagentTab` — allowAgents selector + model override + effective limits (read-only) + active runs summary
- [ ] 9.8 Implement `SessionsTab` — agent-scoped session list with type filter
- [ ] 9.9 Add i18n keys for enhanced agents panel (zh-CN + en)

## 10. Frontend: Subagents Panel (New)

- [ ] 10.1 Create `SubagentsPanel` with 3-tab layout
- [ ] 10.2 Implement `ActiveRunsTab` — tree-nested run cards + lineage tree visualization + 5s polling with visibility-gate
- [ ] 10.3 Implement `HistoryTab` — table with status/agent/task/duration, expandable rows, filters, pagination, ephemeral data empty state
- [ ] 10.4 Implement `ConfigTab` — global defaults form (via config.patch) + per-agent permissions matrix table
- [ ] 10.5 Register Subagents panel in NavRail (OBSERVE group)
- [ ] 10.6 Add i18n keys for subagents panel (zh-CN + en)

## 11. Frontend: Panel Enhancements

- [ ] 11.1 Sessions panel — add Type column with icons (DM/Group/Channel/Subagent), type filter, subagent depth+parent display
- [ ] 11.2 Sessions detail — add lineage block for subagent sessions using LineageTree component
- [ ] 11.3 Skills panel — add "Agent Assignment Matrix" tab with Agent × Skill cross-table, click-to-toggle assignment
- [ ] 11.4 Channels panel — add "Agent Bindings" tab with channel+account selector, binding table, unbind action, DM policy summary

## 12. Cross-Panel Navigation

- [ ] 12.1 Wire all cross-panel links: Routing ↔ Agents ↔ Subagents ↔ Sessions ↔ Channels ↔ Skills
- [ ] 12.2 Verify navigation with prefilled filters (e.g., Agents Routing tab → Routing panel with agentId filter)

## 13. Integration Testing

- [ ] 13.1 E2E test: create binding via Routing panel → verify in Agents Routing tab → simulate route
- [ ] 13.2 E2E test: configure agent skills → verify in Skills matrix
- [ ] 13.3 Verify responsive layouts (desktop/tablet/mobile) for Routing and Subagents panels
