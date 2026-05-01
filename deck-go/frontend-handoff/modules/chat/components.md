# chat — components

> **⚠️ Reverse-derived artifact.** Reconstructed from real engineering code (`frontend-new/src/components/panels/chat/`).

## Component tree

```
ChatPanel
├── (provides ArtifactContext)
├── SessionSidebar
│   ├── AgentTabs                           (top: 全部 · main · ops · ...)
│   ├── Button (新建会话)
│   ├── Input  (搜索会话…)
│   └── SidebarRow [×N]                    (one per session, with delete IconButton)
│
├── ChatContextBar                          (top toolbar)
│   ├── token-count gauge / context %
│   ├── compaction-count chip
│   ├── inference-mode toggle
│   ├── send-policy toggle
│   ├── usage button → opens UsageDrawer
│   ├── speed dropdown
│   ├── compact button
│   └── search button (⌘F) → TranscriptSearch
│
├── (transcript area)
│   ├── "跳转到引导" jump-link              (when steer is below viewport)
│   ├── MessageList
│   │   └── (per message)
│   │       └── TranscriptBlocks           (registry-dispatched per ContentBlock kind)
│   │           ├── MarkdownText           (text block; uses Markdown atom)
│   │           ├── ToolUseCard            (tool_use)
│   │           ├── ToolResultCard         (tool_result)
│   │           ├── ThinkingBlock          (thinking)
│   │           ├── ImageBlock             (image)
│   │           ├── BashResultView         (bash_result)
│   │           ├── FileBlock              (file)
│   │           ├── ToolPair               (paired tool_use + tool_result)
│   │           ├── DiffPreview            (diff blocks)
│   │           ├── CanvasEmbed            (a2ui canvas reference)
│   │           ├── SubagentCard / SubagentTree
│   │           ├── CompactionNotice
│   │           ├── CompactionSummaryModal
│   │           └── UnknownBlockCard       (fallback)
│   ├── BlockFilterBar                     (toggle: 推理 · 工具 · 结果)
│   ├── SteerDialog                        (steer composer; inline)
│   ├── RunStatusBar                       ("运行中" / "工具" tabs)
│   ├── ApprovalDialog                     (when activeApproval present)
│   ├── SSEStatusBanner                    (status === "reconnecting" | "disconnected")
│   ├── CompactionNotice                   (above composer when window near full)
│   └── MessageInput                       (composer)
│       ├── Textarea (auto-grow)
│       ├── attach files button + chip row
│       ├── slash command chip + remove (when active)
│       ├── PromptTemplateMenu
│       ├── MentionPopover                 (@-mentions; powered by useMention)
│       ├── SlashCommandPalette            (/-commands; powered by useSlashCommand + useCommandDiscovery)
│       ├── CanvasToggle / ArtifactToggle
│       ├── char-count + ⌘↵ hint
│       └── send / abort button
│
└── RightPanel (Drawer)
    ├── CanvasPanel                        (a2ui surface; CanvasDebugPanel in dev)
    │   └── (renders surfaces by SurfaceId; auto-opens on canvas message)
    └── ArtifactPanel
        ├── ArtifactCard [×N]              (one per artifact)
        ├── view tabs (raw · diff · preview)
        └── SharedRenderer
            ├── MarkdownViewer
            ├── HighlightedCodeView
            ├── JsonTree
            ├── CodeViewer
            ├── TableViewer
            └── download utility
```

Subcomponents `MessageActions` (per-message hover toolbar), `EmptyState`, `VirtualScrollResult` (list virtualizer wrapper) live alongside.

---

## Top-level props

`ChatPanel` takes **no props**. It reads from stores and the URL:

```ts
export function ChatPanel(): JSX.Element;
```

All state is store-resident or URL-derived.

---

## Subcomponent prop contracts (selected)

### SessionSidebar

```ts
type SessionSidebarProps = {
  sessions: SessionMeta[]; // from useChatStore.getSessionMetas
  activeSessionKey: string | null; // from useChatStore.activeSessionKey
  onSelectSession: (key: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (key: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  agents: Agent[]; // from useAgentsStore
  activeAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};
```

### MessageList

```ts
type MessageListProps = {
  sessionKey: string | null;
  messages: ChatMessage[]; // post-history-normalize
  streaming: boolean;
  runMetadata: Map<string, RunMetadata>;
  onMessageVisible?: (msgId: string) => void;
  blockFilter: BlockFilterState; // from chat-preferences
  onArtifactDetected: (artifact: ArtifactInfo) => void;
};
```

### MessageInput

```ts
type MessageInputProps = {
  sessionKey: string | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: SendPayload) => Promise<void>;
  onAbort: () => Promise<void>;
  disabled: boolean;
  streaming: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  slashState: SlashCommandState;
  mentionState: MentionState;
  contextWarning: ContextWarning | null;
  promptTemplates: PromptTemplate[];
  onTogglePanel: (panel: "canvas" | "artifact") => void;
};
```

### TranscriptBlocks

Registry-driven via `transcript-render-registry.ts`:

```ts
type BlockRendererProps<K extends ContentBlock["kind"]> = {
  block: Extract<ContentBlock, { kind: K }>;
  message: ChatMessage;
  sessionKey: string;
  // additional registry-specific props
};

const transcriptRenderRegistry: {
  [K in ContentBlock["kind"]]: React.FC<BlockRendererProps<K>>;
};
```

### ApprovalDialog

```ts
type ApprovalDialogProps = {
  approval: ApprovalRequest; // from useChatStore.activeApproval
  onApprove: (mode: "once" | "always") => Promise<void>;
  onDeny: () => Promise<void>;
};
```

### SSEStatusBanner

```ts
type SSEStatusBannerProps = {
  status: SSEConnectionStatus; // "connected" | "reconnecting" | "disconnected"
  onRetry?: () => void;
};
```

### CanvasPanel

```ts
type CanvasPanelProps = {
  sessionKey: string;
  a2uiState: A2UIState | null; // from useChatStore.getSessionA2UIState
  open: boolean;
  onClose: () => void;
};
```

### ArtifactPanel

```ts
type ArtifactPanelProps = {
  sessionKey: string;
  artifacts: ArtifactInfo[];
  active: ArtifactInfo | null;
  onSelectArtifact: (info: ArtifactInfo) => void;
  onClose: () => void;
};
```

---

## Visual / layout invariants (must not be lost in translation)

- **Three-column shell** at ≥ 1280px viewport: sidebar (300px) · transcript (flex) · right-panel (380px when open)
- **Sidebar collapse** on `< 960px` viewport: sidebar becomes a Drawer
- **Right panel** is a `Drawer` (atom) — does not push transcript width when open at desktop sizes
- **Transcript area** vertical layout: `[ChatContextBar] · [transcript scroll] · [BlockFilterBar] · [SteerDialog] · [RunStatusBar] · [ApprovalDialog?] · [SSEStatusBanner?] · [CompactionNotice?] · [MessageInput]`
- **Message footer metadata** rendered at `var(--ds-fs-meta)` size — token counts, model, run state, timing
- **Streaming indicator**: `WaitingDots` atom inline in active message; replaced by message-stable cursor on partial render
- **Class names retained from prototype**: `ds-chat-shell`, `ds-chat-shell__sidebar`, `ds-chat-shell__main`, `ds-chat-shell__right`, `ds-session-row`, `ds-message-input`, `ds-message-input__warning-text`, etc. — these survive translation; do **not** rename to non-prototype classes
- **Token references**: every color / spacing / radius reads `var(--ds-*)`
