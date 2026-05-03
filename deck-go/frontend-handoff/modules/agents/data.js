// Contract-shaped mock data for agents prototype.
// Every object matches the DTO from contracts/generated/ts/deck-api.generated.ts.

window.MOCK = {
  // DeckGoAgentsListResponse
  agentsList: {
    agents: [
      {
        id: "main",
        name: "Main",
        emoji: "M",
        status: "idle",
        isDefault: true,
        model: "gpt-5.4",
        workspace: "/workspace",
        sessionCount: 18,
        bindingCount: 4,
        lastActiveAtMs: 1714680000000,
      },
      {
        id: "ops",
        name: "Ops Runner",
        emoji: "O",
        status: "busy",
        isDefault: false,
        model: "sonnet-4.6",
        workspace: "/workspace/ops",
        sessionCount: 7,
        bindingCount: 2,
        lastActiveAtMs: 1714676400000,
      },
      {
        id: "research",
        name: "Research",
        emoji: "R",
        status: "idle",
        isDefault: false,
        model: "opus-4.6",
        workspace: "/workspace/research",
        sessionCount: 3,
        bindingCount: 1,
        lastActiveAtMs: 1714590000000,
      },
      {
        id: "legacy-bot",
        name: "Legacy Bot",
        status: "offline",
        isDefault: false,
        // no model, no workspace, no emoji — tests missing-optional rendering
        sessionCount: undefined,
        bindingCount: undefined,
      },
    ],
    defaultId: "main",
  },

  // DeckGoAgentDetailResponse (per agent id)
  detail: {
    main: {
      id: "main",
      name: "Main",
      workspace: "/workspace",
      model: "gpt-5.4",
      reasoningDefault: "on",
      fastModeDefault: false,
      isDefault: true,
      bindingCount: 4,
      sessionCount: 18,
      activeSubagentCount: 1,
      skillMode: "whitelist",
      effectiveSkills: ["read", "write", "exec"],
      totalAvailableSkills: 8,
      subagents: {
        allowAgents: ["ops", "research"],
        model: "sonnet-4.6",
        effectiveMaxSpawnDepth: 3,
        effectiveMaxChildrenPerAgent: 5,
      },
      identityExists: true,
      fallbackModels: ["sonnet-4.6", "haiku-4.5"],
    },
    ops: {
      id: "ops",
      name: "Ops Runner",
      workspace: "/workspace/ops",
      model: "sonnet-4.6",
      isDefault: false,
      bindingCount: 2,
      sessionCount: 7,
      activeSubagentCount: 0,
      skillMode: "all",
      effectiveSkills: [],
      totalAvailableSkills: 8,
      subagents: {
        allowAgents: [],
        effectiveMaxSpawnDepth: 2,
        effectiveMaxChildrenPerAgent: 3,
      },
      identityExists: true,
      fallbackModels: [],
    },
  },

  // DeckGoAgentSkillsResponse
  skills: {
    agentId: "main",
    mode: "whitelist",
    skills: ["read", "write", "exec"],
    available: [
      { key: "read", name: "Read files", eligible: true, assigned: true },
      { key: "write", name: "Write files", eligible: true, assigned: true },
      { key: "exec", name: "Execute commands", eligible: true, assigned: true },
      { key: "browser", name: "Browser automation", eligible: true, assigned: false },
      { key: "search", name: "Web search", eligible: true, assigned: false },
      { key: "mcp-server", name: "MCP server tools", eligible: false, assigned: false },
      { key: "notebook", name: "Notebook edit", eligible: true, assigned: false },
      { key: "task", name: "Task management", eligible: true, assigned: false },
    ],
    configHash: "skills-abc123",
  },

  // DeckGoAgentSubagentConfigResponse
  subagentConfig: {
    agentId: "main",
    allowAgents: ["ops", "research"],
    allowAny: false,
    model: "sonnet-4.6",
    effectiveMaxSpawnDepth: 3,
    effectiveMaxChildrenPerAgent: 5,
    allAgents: ["ops", "research", "legacy-bot"],
    configHash: "sub-def456",
  },

  // DeckGoAgentToolPolicyPreviewResponse
  toolPolicy: {
    layers: [
      { label: "System defaults", ruleCount: 12, effect: "baseline allow/deny" },
      { label: "Agent identity", ruleCount: 3, effect: "override" },
      { label: "User settings", ruleCount: 4, effect: "override" },
      { label: "Session runtime", ruleCount: 0, effect: "none active" },
    ],
    tools: [
      { name: "Bash", allowed: true, decisiveLayer: "System defaults" },
      { name: "Read", allowed: true, decisiveLayer: "System defaults" },
      { name: "Write", allowed: true, decisiveLayer: "System defaults" },
      { name: "Edit", allowed: true, decisiveLayer: "System defaults" },
      { name: "Agent", allowed: true, decisiveLayer: "Agent identity" },
      { name: "WebFetch", allowed: false, decisiveLayer: "User settings" },
      { name: "WebSearch", allowed: false, decisiveLayer: "User settings" },
      { name: "NotebookEdit", allowed: true, decisiveLayer: "System defaults" },
    ],
  },

  // DeckGoAgentSystemPromptPreviewResponse
  systemPrompt: {
    layers: [
      { label: "Core system", source: "built-in", charCount: 4200, fileCount: 0 },
      {
        label: "CLAUDE.md (project)",
        source: "/workspace/CLAUDE.md",
        charCount: 8900,
        fileCount: 1,
      },
      { label: "CLAUDE.md (user)", source: "~/.claude/CLAUDE.md", charCount: 3100, fileCount: 1 },
      { label: "Agent identity", source: "agents/main", charCount: 420, fileCount: 0 },
    ],
    bootstrapFiles: [
      { name: "CLAUDE.md", exists: true, charCount: 8900 },
      { name: "AGENTS.md", exists: true, charCount: 4200 },
      { name: ".claude/settings.json", exists: true, charCount: 620 },
      { name: ".cursorrules", exists: false, charCount: 0 },
    ],
    totalChars: 16620,
    configHash: "prompt-ghi789",
  },

  // DeckGoAgentFilesResponse
  files: {
    agentId: "main",
    workspace: "/workspace",
    files: [
      { name: "AGENTS.md", path: "/workspace/AGENTS.md", size: 4200, updatedAtMs: 1714600000000 },
      { name: "CLAUDE.md", path: "/workspace/CLAUDE.md", size: 8900, updatedAtMs: 1714590000000 },
      {
        name: ".claude/settings.json",
        path: "/workspace/.claude/settings.json",
        size: 620,
        updatedAtMs: 1714580000000,
      },
    ],
  },

  // DeckGoAgentFileResponse (sample file content)
  fileContent: {
    "AGENTS.md":
      "# Workspace Agents\n\nThis file configures agent behavior for the workspace.\n\n## Main Agent\n\n- Model: gpt-5.4\n- Skills: read, write, exec\n- Subagents: ops, research\n\n## Ops Runner\n\n- Model: sonnet-4.6\n- Workspace: /workspace/ops\n- Focus: operational tasks\n",
    "CLAUDE.md":
      "# Project Guidelines\n\nThis is the project-level CLAUDE.md with coding standards,\narchitecture decisions, and workflow conventions.\n\n## Build\n\npnpm build\npnpm test\n",
  },

  // DeckGoAgentEventStreamsResponse
  eventStreams: {
    agentId: "main",
    eventStreams: ["agent.status.changed", "activity.event"],
    isDefault: true,
    configHash: "stream-jkl012",
  },

  // Available stream options (declared contracts)
  streamOptions: [
    "agent.status.changed",
    "activity.event",
    "session.message",
    "session.tool",
    "sessions.changed",
  ],
};
