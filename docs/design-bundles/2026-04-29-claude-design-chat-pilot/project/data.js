// Mock data for the deck-go chat redesign prototype.
window.MOCK = (() => {
  const sessions = [
    {
      key: "s1",
      title: "Refactor TranscriptBlocks dispatcher",
      preview: "Try to merge tool_use + tool_result into a paired card…",
      updated: "2m",
      streaming: true,
    },
    {
      key: "s2",
      title: "Approve shell commands for openclaw bootstrap",
      preview: "pnpm install && pnpm build && pnpm dev",
      updated: "14m",
    },
    {
      key: "s3",
      title: "Investigate canvas iframe SSR mismatch",
      preview: "Saw an a2ui-bridge handshake timeout on Firefox 124…",
      updated: "1h",
    },
    {
      key: "s4",
      title: "deck-go i18n key audit",
      preview: "Looking for missing approvals.* keys in zh-CN…",
      updated: "3h",
    },
    {
      key: "s5",
      title: "Design review: ChatContextBar token chip",
      preview: "Should the context bar visualize cache hits separately?",
      updated: "yesterday",
    },
    {
      key: "s6",
      title: "Diff preview perf with 5k-line files",
      preview: "VirtualScrollResult kicks in at 200, but diff renders…",
      updated: "yesterday",
    },
    {
      key: "s7",
      title: "ApprovalDialog countdown a11y",
      preview: "Screen readers announce the remaining seconds every…",
      updated: "Mon",
    },
    {
      key: "s8",
      title: "Subagent tree color contrast",
      preview: "lineage 3+ depth gets unreadable on light theme.",
      updated: "Mon",
    },
    {
      key: "s9",
      title: "Compaction notice copy",
      preview: "tokensBefore → tokensAfter wording test",
      updated: "Sun",
    },
    {
      key: "s10",
      title: "Rename: visual-long-title 中英混排测试用例",
      preview: "确保删除按钮不撞标题省略号…",
      updated: "Sun",
    },
  ];

  // A streaming-style transcript that exercises every block type & state.
  const transcript = [
    {
      id: "m1",
      role: "user",
      time: "10:42",
      blocks: [
        {
          type: "text",
          text: "Help me wire up a paired tool card and inspect the bash output of `pnpm typecheck`. Also read `panels/chat/MessageInput.tsx` and propose a refactor.",
        },
      ],
    },
    {
      id: "m2",
      role: "assistant",
      time: "10:42",
      streaming: true,
      meta: {
        model: "claude-sonnet-4.6",
        inTok: 4218,
        outTok: 612,
        cacheHit: 0.71,
        cost: 0.018,
        durationMs: 7400,
      },
      blocks: [
        {
          type: "thinking",
          expanded: true,
          streaming: false,
          text: "The user wants two things:\n1. A paired tool card (use+result merged)\n2. Inspect `pnpm typecheck` output\n3. Refactor proposal for MessageInput.tsx\n\nLet me start by running typecheck so I have ground truth, then read the file.",
        },
        {
          type: "tool_use",
          tool: "shell_command",
          input: { command: "pnpm typecheck", cwd: "/workspace/deck-go/frontend" },
          status: "completed",
        },
        {
          type: "tool_result",
          viewType: "bash",
          forTool: "shell_command",
          bash: {
            exit: 0,
            stdout:
              "> deck-go-frontend@0.1.0 typecheck\n> tsc --noEmit\n\nFound 0 errors. Watching for file changes.",
            stderr: "",
          },
        },
        {
          type: "tool_use",
          tool: "read_file",
          input: { path: "panels/chat/MessageInput.tsx", limit: 60 },
          status: "completed",
        },
        {
          type: "tool_result",
          viewType: "read",
          forTool: "read_file",
          read: {
            lang: "tsx",
            path: "panels/chat/MessageInput.tsx",
            lines: [
              'import { useRef, useState, useCallback } from "react";',
              'import { useChatStore } from "@/state/chat";',
              'import { SlashCommandPalette } from "./SlashCommandPalette";',
              'import { MentionPopover } from "./MentionPopover";',
              'import { ApprovalDialog } from "./ApprovalDialog";',
              'import { PromptTemplateMenu } from "./PromptTemplateMenu";',
              "",
              "export function MessageInput({ sessionKey }: Props) {",
              "  const ref = useRef<HTMLTextAreaElement>(null);",
              '  const [text, setText] = useState("");',
              "  const [files, setFiles] = useState<File[]>([]);",
              '  const [slash, setSlash] = useState({ showPalette: false, mode: "filter" });',
              "  // …693 lines total",
            ],
          },
        },
        {
          type: "tool_use",
          tool: "edit_file",
          input: { path: "panels/chat/blocks/ToolPair.tsx", op: "create" },
          status: "completed",
        },
        {
          type: "tool_result",
          viewType: "diff",
          forTool: "edit_file",
          diff: {
            path: "panels/chat/blocks/ToolPair.tsx",
            added: 38,
            removed: 0,
            hunks: [
              { kind: "add", line: 'import { ToolUseHeader } from "./ToolUseCard";' },
              { kind: "add", line: 'import { ResolveResultBody } from "./ToolResultCard";' },
              { kind: "ctx", line: "" },
              { kind: "add", line: "export function ToolPair({ use, result, paired }: Props) {" },
              { kind: "add", line: '  const variant = result?.isError ? "error" : "ok";' },
              { kind: "add", line: "  return (" },
              { kind: "add", line: "    <section data-paired={paired} data-variant={variant}>" },
              { kind: "add", line: "      <ToolUseHeader block={use} compact />" },
              {
                kind: "add",
                line: "      {result && <ResolveResultBody block={result} embedded />}",
              },
              { kind: "add", line: "    </section>" },
              { kind: "add", line: "  );" },
              { kind: "add", line: "}" },
            ],
          },
        },
        {
          type: "text",
          text: "Done. **Findings**:\n- `pnpm typecheck` is clean — no blockers.\n- `MessageInput.tsx` is 693 lines and fuses 6 concerns (textarea, slash, mention, approval, attach, ghost-hint). I'd extract `useComposerState` and split each popover into its own subtree.\n\nNext I'll draft the hook signature.",
        },
        {
          type: "tool_use",
          tool: "shell_command",
          input: { command: 'node -e "console.log(process.version)"', cwd: "/workspace" },
          status: "running",
        },
      ],
    },
    {
      id: "m3",
      role: "system-compact",
      blocks: [
        {
          type: "text",
          text: "Conversation compacted: 12,840 → 3,210 tokens (older 18 messages summarized).",
        },
      ],
    },
    {
      id: "m4",
      role: "user",
      time: "10:51",
      blocks: [
        {
          type: "text",
          text: "Show me the failing test file and the fixture image we attached earlier.",
        },
        { type: "file", name: "trace.har", size: "412 KB" },
      ],
    },
    {
      id: "m5",
      role: "assistant",
      time: "10:51",
      meta: {
        model: "claude-sonnet-4.6",
        inTok: 5102,
        outTok: 248,
        cacheHit: 0.84,
        cost: 0.011,
        durationMs: 3100,
      },
      blocks: [
        {
          type: "tool_use",
          tool: "read_file",
          input: { path: "panels/chat/__tests__/MessageList.test.tsx" },
          status: "completed",
        },
        {
          type: "tool_result",
          viewType: "read",
          isError: true,
          read: {
            lang: "tsx",
            path: "panels/chat/__tests__/MessageList.test.tsx",
            error: "ENOENT: no such file or directory",
          },
        },
        {
          type: "tool_use",
          tool: "read_file",
          input: { path: "fixtures/canvas-empty.png" },
          status: "completed",
        },
        {
          type: "tool_result",
          viewType: "read",
          forTool: "read_file",
          image: { path: "fixtures/canvas-empty.png", w: 640, h: 360 },
        },
        {
          type: "text",
          text: "The test file path was wrong — corrected, and here's the fixture image. Want me to open the canvas with this fixture in the right drawer?",
        },
        { type: "canvas_inline", title: "canvas-empty preview" },
      ],
    },
  ];

  // Approvals queue
  const approval = {
    id: "ap-7",
    tool: "shell_command",
    command: "rm -rf node_modules && pnpm install --frozen-lockfile",
    cwd: "/workspace/deck-go/frontend",
    agent: "main",
    expiresIn: 83, // seconds
    pending: 3,
  };

  const slashCommands = [
    { cmd: "/model", desc: "Switch model for this session", mode: "argOptions" },
    { cmd: "/clear", desc: "Clear current transcript", mode: "immediate" },
    { cmd: "/compact", desc: "Compact conversation history", mode: "immediate" },
    { cmd: "/canvas", desc: "Open canvas panel", mode: "immediate" },
    { cmd: "/approve", desc: "Set approval policy", mode: "argOptions" },
    { cmd: "/system", desc: "Edit system prompt", mode: "tag" },
    { cmd: "/files", desc: "Attach files from path", mode: "tag" },
    { cmd: "/agents", desc: "List available agents", mode: "filter" },
  ];

  const mentionAgents = [
    { id: "main", name: "main", desc: "Default coding agent" },
    { id: "researcher", name: "researcher", desc: "Web research subagent" },
    { id: "reviewer", name: "code-reviewer", desc: "PR review subagent" },
    { id: "designer", name: "frontend-design", desc: "UI critique subagent" },
  ];

  const subagentTree = {
    name: "main",
    status: "running",
    children: [
      { name: "researcher", status: "done", children: [{ name: "fetch-docs", status: "done" }] },
      {
        name: "code-reviewer",
        status: "running",
        children: [
          { name: "lint-pass", status: "done" },
          { name: "type-check", status: "running" },
        ],
      },
    ],
  };

  return { sessions, transcript, approval, slashCommands, mentionAgents, subagentTree };
})();
