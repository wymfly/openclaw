# agents — states

> State machine, store shape, and edge cases. Engineering source-of-truth lives in `frontend/src/stores/agents-detail.ts` and `agents-create.ts` after implementation.

## Store shape (proposed)

```ts
// agents (shared, existing — extended)
type AgentsStore = {
  list: AgentSummary[]; // v2 shape
  loadingList: boolean;
  listError: string | null;
  query: {
    search: string;
    sortBy: "recent" | "name" | "sessions";
    filter: "all" | "busy" | "default";
  };
  cursor: string | null; // pagination cursor
};

// agents-detail (new, module-private)
type AgentsDetailStore = {
  detailMap: Map<
    AgentId,
    {
      detail: AgentDetail; // full hydrated agent
      skills: SkillsResponse;
      subagents: SubagentConfigResponse;
      streams: AgentEventStreamsResponse;
      toolPolicy: ToolPolicyPreview | null;
      systemPrompt: SystemPromptPreview | null;
      files: AgentFile[] | null;
      hashes: AgentConfigHashes; // composite hash family
      dirty: { skills: boolean; subagents: boolean; streams: boolean; identity: boolean };
      saving: { skills: boolean; subagents: boolean; streams: boolean; identity: boolean };
      error: { skills?: string; subagents?: string; streams?: string; identity?: string };
    }
  >;
  activeAgentId: AgentId | null;
  activeSection: SectionId;
};

// agents-create (new, module-private)
type AgentsCreateStore = {
  open: boolean;
  step: 0 | 1 | 2 | 3 | 4;
  draft: AgentDraft;
  validation: Record<number, string[]>; // per-step error list
  submitting: boolean;
  submitError: string | null;
};
```

## High-level state machine

```
                ┌──────────┐
                │ closed   │ — user is on /chat or another panel
                └────┬─────┘
                     │ navigate to /agents
                     ▼
              ┌──────────────┐
              │ list:loading │
              └──────┬───────┘
       ┌────────────┴─────────────┐
       │ success                  │ error
       ▼                          ▼
  ┌──────────┐               ┌──────────────┐
  │ list:ok  │  ───retry───→ │ list:errored │
  └────┬─────┘               └──────────────┘
       │ click row
       ▼
   ┌────────────────┐
   │ detail:loading │ ← only first time per agent
   └──────┬─────────┘
          │ success
          ▼
   ┌──────────────┐
   │ detail:ok    │ ── edit ──→ detail:dirty
   └──────────────┘                  │
          ▲                          │ click "Save changes"
          │                          ▼
          │                    detail:saving
          │      success ┌─────────┴────────┐ error
          ◀──────────────┘                  └──→ detail:save-errored
                                                  │ retry / dismiss
                                                  ▼
                                              detail:dirty
```

## Edge cases

### EC-1 — Stale optimistic lock on save

User A and User B both edit `agt_main` skills concurrently. User A saves first. When User B saves:

- Server returns `409 Conflict` with `{ currentHash, currentValue }`
- UI surfaces a `<Banner kind="warning">` at the top of the section: _"Someone else updated this. Reload to merge."_
- `Save changes` becomes `Reload & merge` — clicking re-fetches and discards local edits (with confirm)

### EC-2 — Agent deleted while detail open

Activity stream emits `agent.removed { agentId }`. If the deleted agent === `activeAgentId`:

- Hard-replace detail with full-screen Banner: _"This agent was deleted. Return to list."_
- Provide a single `Return to list` button → `setView("list")`

### EC-3 — Live status flicker

`activity.event` may rapidly toggle `idle ↔ busy`. To avoid status-dot strobing:

- Debounce status transitions: a transition is committed only if the new state holds for ≥ 250ms
- The pulse animation has a 1.6s cycle, so brief (<250ms) busy bursts show as a single pulse, not strobe

### EC-4 — Pre-existing default agent on toggle

User toggles `isDefault: true` on `agt_research`. Server enforces "exactly one default":

- Optimistic UI flips the toggle immediately
- On 200, refetch list — the previous default row's badge disappears
- On 4xx, revert toggle and show toast

### EC-5 — Invalid workspace path

User types `/relative/path` (not absolute). On Save:

- Server returns `400 { code: "WORKSPACE_NOT_ABSOLUTE" }`
- UI shows inline `<FieldError>` under the input, focuses the field

### EC-6 — Wizard "Create" while session already open

User opens wizard, fills it out, but before clicking Create they open chat in another tab and start a session with a same-named agent. On final Create:

- Server returns `409 { code: "AGENT_NAME_TAKEN" }`
- Wizard surfaces the error on Step 0 (Identity), focus jumps back to step 0

### EC-7 — Right after save, navigate away

User saves Skills, then immediately clicks `Subagents` nav. The `<SkillsSection>` save is in-flight:

- Section navigation is **not** blocked
- The toast/banner for the in-flight save still appears once it resolves
- If save errors, the `<DetailNav>` shows a small `⚠` indicator on the `Skills` section badge so the user can navigate back

### EC-8 — SSE disconnected during list view

`activity.event` SSE disconnects for >5s:

- Top-of-list inline `<Banner kind="info">`: _"Live status unavailable. Showing last-known state from <ts>."_
- Status dots become solid (no pulse) and dimmed slightly (`opacity: 0.6`)

### EC-9 — File upload exceeds size limit

Server returns `413 { code: "FILE_TOO_LARGE", maxBytes }`:

- Toast with the human-readable max
- Failed file marked with red border in the upload list; user can dismiss or retry with a smaller file

### EC-10 — Cancel mid-wizard with unsaved progress

User has filled steps 0–2 and presses Esc:

- Confirm modal: _"Discard agent draft?"_ → Discard / Continue editing
- On Discard, `agents-create` resets to initial state

## Loading & empty states (per surface)

| Surface       | Loading                      | Empty                                         | Errored                            |
| ------------- | ---------------------------- | --------------------------------------------- | ---------------------------------- |
| List          | Skeleton rows × 6            | EmptyState — "No agents yet" + "Create" CTA   | Banner with retry                  |
| Detail nav    | Spinner in header            | (n/a — only renders when agent loaded)        | Replace nav with error placeholder |
| Overview      | Field skeletons              | (n/a — always populated post-create)          | Inline banner above fields         |
| Skills        | Skeleton row × 5             | "No skills configured" + link to inherit mode | Inline banner                      |
| Subagents     | Skeleton row × 4             | "No agents to delegate to" + Create CTA       | Inline banner                      |
| Tool policy   | Spinner + 4 placeholder rows | "No rules" — _theoretical, see EC notes_      | Inline banner + Recompute button   |
| System prompt | Codeblock skeleton           | (n/a — defaults always exist)                 | Inline banner + Recompute button   |
| Files         | Skeleton rows × 4            | "No files yet" + Upload CTA                   | Inline banner                      |
| Event streams | Skeleton rows × 2            | (n/a — defaults exist)                        | Inline banner                      |

## Dirty / save indicators

- **Per-section save button** is the canonical save trigger
- Top of detail shows `<Banner kind="info">` _"You have unsaved changes in: Skills, Streams"_ whenever `dirty.*` has ≥1 truthy
- Browser `beforeunload` is intercepted only when any `dirty.*` is truthy
- Switching agent (back to list, click another row) while dirty → confirm modal
