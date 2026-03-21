## Context

The Agents panel (`AgentDetail.tsx`) currently provides 5 tabs for basic operational monitoring (Overview, Routing, Skills, Subagent, Sessions). The gateway already has a rich internal model for agent configuration — tool policy pipelines (`tool-policy-pipeline.ts` with 7 layers), system prompt assembly (`pi-embedded-runner/run/attempt.ts` → `system-prompt-report.ts`), bootstrap files (`workspace.ts`), and identity settings — but none of this is surfaced in the dashboard.

The existing `FallbackChain` component in the Models panel demonstrates a reusable pattern for ordered-list visualization with drag-reorder and auto-save. The `deck.agents.files.*` RPCs already support reading and writing workspace files (BOOTSTRAP.md, HEARTBEAT.md, IDENTITY.md, SOUL.md, TOOLS.md, USER.md).

## Goals / Non-Goals

**Goals:**

- Give ops full visibility into how an agent's system prompt is assembled from its constituent layers
- Visualize the 7-layer tool policy pipeline showing per-tool allow/deny resolution
- Enable inline editing of bootstrap workspace files without leaving the dashboard
- Surface model fallback chain, sandbox mode, and identity preview in the Overview tab
- Keep all new functionality read-heavy (preview/visualize) with surgical write capabilities

**Non-Goals:**

- Agent creation wizard or agent marketplace
- Multi-agent orchestration UI
- Editing the config YAML directly from the dashboard (only workspace markdown files)
- Real-time prompt streaming or live agent debugging (covered by deck-chat-whitebox)
- Changing the tool policy pipeline structure itself (read-only visualization)

## Decisions

### D1: Context Tab — Layered Prompt Composition Viewer

**Choice:** Render system prompt as a collapsible layer stack (bootstrap files → identity → skills → extra instructions → hooks), with a "Preview Full Prompt" toggle that shows the final assembled text.

**Rationale:** The `buildSystemPromptReport()` already produces a `SessionSystemPromptReport` with per-section breakdowns (identity, skills blocks, bootstrap injection stats, tool entries). A new RPC `deck.agents.systemPrompt.preview` will call the same assembly chain in dry-run mode and return the report structure plus the final text.

**Alternatives considered:**

- Rendering only the final text: loses the "composition layers" insight that makes debugging valuable
- Live prompt editing: too risky for ops tool; read-only preview is safer and still delivers 90% of the value

### D2: Tool Policy Pipeline Visualization — Stacked Layers

**Choice:** Render the 7 policy layers as a vertical pipeline diagram. Each layer shows its source (config key), rule count, and effect. A per-tool detail view shows the resolution chain: which layer allowed/denied each tool and the final result.

**Rationale:** The existing `buildDefaultToolPolicyPipelineSteps()` returns labeled steps. A new RPC `deck.agents.toolPolicy.preview` will execute the pipeline against the agent's full tool list and return per-tool resolution traces.

**Alternatives considered:**

- Table-only view (tool × layer matrix): too dense for 7 layers × 20+ tools; pipeline diagram scales better
- Client-side policy resolution: requires shipping policy logic to frontend; server-side keeps it authoritative

### D3: Bootstrap File Editor — Inline Markdown with existing RPCs

**Choice:** Use the existing `deck.agents.files.get` / `deck.agents.files.set` RPCs for reading/writing workspace files. Render a simple CodeMirror-style textarea (or Monaco if already bundled) with syntax highlighting for Markdown.

**Rationale:** The file RPCs already handle path validation, safe writes, and the allowed file list (`BOOTSTRAP_FILE_NAMES`). No new backend work needed for basic editing.

**Alternatives considered:**

- Full Monaco editor: heavier bundle; a styled textarea with markdown preview is sufficient for these small files
- Separate "Files" tab: fragments the UX; bootstrap files are part of the agent's "context", so they belong in the Context tab

### D4: Overview Enhancements — Reuse FallbackChain Component

**Choice:** Import `FallbackChain` from the Models panel into the Overview tab. Display the agent's model + fallback chain (read from agent config). Add a sandbox mode badge/selector and identity preview card.

**Rationale:** `FallbackChain` already handles drag-reorder, auto-save, and status indicators. The agent's model config (`agents.<id>.model`, `agents.<id>.fallback`) maps directly to the same `primary` + `fallbacks` props.

**Alternatives considered:**

- Building a separate fallback visualization: duplicates effort; the existing component is well-tested
- Putting model config in a separate "Model" tab: Overview is the right landing spot for this at-a-glance info

### D5: New RPCs — Preview-Only, No Side Effects

**Choice:** Both new RPCs (`deck.agents.toolPolicy.preview`, `deck.agents.systemPrompt.preview`) are read-only. They compute the result on-the-fly without persisting anything. They accept `agentId` and optionally `sessionContext` (channel, chatType) for context-sensitive previews.

**Rationale:** Preview RPCs should never mutate state. Optional session context allows ops to see how the prompt/tools differ by channel (e.g., voice channel denies TTS tool).

### D6: Tab Placement — Context Tab After Skills

**Choice:** Tab order: Overview | Routing | Skills | **Context** | Subagent | Sessions.

**Rationale:** Context (prompt + tools + files) is closely related to Skills. Placing it between Skills and Subagent groups "what the agent knows/can do" together.

## Risks / Trade-offs

- **[System prompt assembly in dry-run mode may diverge from actual runtime]** → Mitigation: The preview RPC will call the same `buildEmbeddedSystemPrompt` + `buildSystemPromptReport` functions used at runtime, just without creating a real session. Add a "preview approximation" disclaimer in the UI.

- **[Tool policy preview may be stale if config changes between render and runtime]** → Mitigation: Add a "Refresh" button and show the config hash used for the preview. The `configHash` pattern is already used in Skills and Subagent tabs.

- **[Bootstrap file editing could break an agent if user writes invalid markdown]** → Mitigation: Files are plain Markdown with no schema validation needed. Add a confirmation dialog before save. The existing `deck.agents.files.set` RPC already handles safe writes.

- **[FallbackChain reuse may need adapter for agent-level model config]** → Mitigation: The agent config shape (`model` + `fallback` array) is simpler than the global model catalog. A thin adapter function that maps agent config → `FallbackChainProps` is straightforward.

- **[Context tab could become too dense with prompt + tools + files]** → Mitigation: Use collapsible sections. Prompt layers collapsed by default; files as a secondary accordion. Tool policy gets its own sub-section with expandable per-tool details.
