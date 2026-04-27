// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../../../i18n/config";
import { DeckIntlProvider } from "../../../i18n/provider";
import { AgentsPanel } from "./AgentsPanel";

const apiMocks = vi.hoisted(() => ({
  createAgent: vi.fn(),
  deleteAgent: vi.fn(),
  fetchAgentEventStreams: vi.fn(),
  fetchAgentFile: vi.fn(),
  fetchAgentFiles: vi.fn(),
  fetchAgentDetail: vi.fn(),
  fetchAgentHealthSnapshot: vi.fn(),
  fetchAgentIdentity: vi.fn(),
  fetchAgentRawConfig: vi.fn(),
  fetchAgentsList: vi.fn(),
  fetchAgentSkills: vi.fn(),
  fetchAgentSubagentConfig: vi.fn(),
  fetchAgentSystemPromptPreview: vi.fn(),
  fetchAgentToolPolicyPreview: vi.fn(),
  fetchEffectiveTools: vi.fn(),
  fetchRoutingBindings: vi.fn(),
  fetchRuntimeConfiguredModels: vi.fn(),
  fetchSkills: vi.fn(),
  fetchSessions: vi.fn(),
  fetchSubagentRuns: vi.fn(),
  fetchToolsCatalog: vi.fn(),
  installSkill: vi.fn(),
  removeRoutingBinding: vi.fn(),
  updateSkill: vi.fn(),
  updateAgentEventStreams: vi.fn(),
  updateAgentRawConfig: vi.fn(),
  updateAgentSkills: vi.fn(),
  updateAgentSubagentConfig: vi.fn(),
  updateAgent: vi.fn(),
  saveAgentFile: vi.fn(),
  streamEvents: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToPanel: vi.fn(),
  navigateToRouting: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToPanel: deckUIMocks.navigateToPanel,
  navigateToRouting: deckUIMocks.navigateToRouting,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;
let latestStreamParams:
  | {
      signal: AbortSignal;
      onEvent: (event: { event?: string; data?: string; json?: unknown }) => void;
    }
  | undefined;

function expectTextOneOf(...values: string[]) {
  expect(values.some((value) => container.textContent?.includes(value))).toBe(true);
}

function findButtonByText(...values: string[]) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    values.some((value) => button.textContent?.includes(value)),
  );
}

function renderAgentsPanel(locale: Locale = "en") {
  root?.render(createElement(DeckIntlProvider, { locale }, createElement(AgentsPanel)));
}

function agentsList(includeCreated = false) {
  return {
    defaultId: "main",
    agents: [
      { id: "main", name: "Main Agent", workspace: "/repo", model: "sonnet-4.6", status: "idle" },
      {
        id: "builder",
        name: "Builder Agent",
        workspace: "/repo/build",
        model: "gpt-5.4",
        status: "busy",
      },
      ...(includeCreated
        ? [
            {
              id: "builder2",
              name: "Builder Two",
              workspace: "/tmp/build",
              model: "gpt-5.4-mini",
              status: "idle",
            },
          ]
        : []),
    ],
  };
}

function agentDetail(id: string) {
  return {
    id,
    name:
      {
        main: "Main Agent",
        builder: "Builder Agent",
        builder2: "Builder Two",
      }[id] ?? id,
    workspace: id === "builder2" ? "/tmp/build" : "/repo",
    model: id === "builder" ? "gpt-5.4" : "sonnet-4.6",
    reasoningDefault: "stream" as const,
    fastModeDefault: false,
    isDefault: id === "main",
    bindingCount: id === "builder" ? 2 : 1,
    sessionCount: id === "builder2" ? 0 : 3,
    activeSubagentCount: id === "builder" ? 1 : 0,
    skillMode: "auto",
    effectiveSkills: ["shell"],
    totalAvailableSkills: 12,
    subagents: {
      allowAgents: ["main"],
      effectiveMaxSpawnDepth: 2,
      effectiveMaxChildrenPerAgent: 4,
    },
    sandbox:
      id === "main"
        ? { mode: "on", backend: "docker", filesystem: "restricted", elevation: "standard" }
        : { mode: "off" },
    identityExists: true,
    fallbackModels: id === "main" ? ["gpt-5.4-mini"] : [],
  };
}

describe("AgentsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "NEXT_LOCALE=en;path=/";
    window.history.replaceState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchAgentsList.mockResolvedValue(agentsList());
    apiMocks.fetchRuntimeConfiguredModels.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        models: [
          { id: "gpt-5.4", name: "GPT 5.4", provider: "openai" },
          { id: "gpt-5.4-mini", name: "GPT 5.4 Mini", provider: "openai" },
          { id: "claude-4.6", name: "Claude 4.6", provider: "anthropic" },
        ],
      },
    });
    apiMocks.fetchAgentDetail.mockImplementation(async (id: string) => agentDetail(id));
    apiMocks.fetchAgentHealthSnapshot.mockResolvedValue({
      agents: [{ agentId: "main", sessions: { count: 2 } }],
    });
    latestStreamParams = undefined;
    localStorage.clear();
    apiMocks.streamEvents.mockImplementation(
      (params: {
        signal: AbortSignal;
        onEvent: (event: { event?: string; data?: string; json?: unknown }) => void;
      }) => {
        latestStreamParams = params;
        return new Promise<void>((resolve) => {
          params.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    );
    apiMocks.fetchAgentEventStreams.mockResolvedValue({
      agentId: "main",
      eventStreams: ["lifecycle", "assistant"],
      isDefault: true,
      configHash: "hash-1",
    });
    apiMocks.fetchAgentSkills.mockResolvedValue({
      agentId: "main",
      mode: "whitelist",
      skills: ["shell"],
      available: [
        { key: "shell", name: "Shell Skill", eligible: true, assigned: true },
        { key: "memory", name: "Memory Skill", eligible: true, assigned: false },
        { key: "legacy", name: "Legacy Skill", eligible: false, assigned: false },
      ],
      configHash: "skills-hash-1",
    });
    apiMocks.fetchSkills.mockResolvedValue({
      skills: [
        {
          key: "shell",
          name: "Shell Skill",
          source: "bundled",
          disabled: false,
          eligible: true,
          config: { apiKey: "shell-key", env: { SHELL_MODE: "safe" } },
          install: [{ id: "brew-shell", label: "Homebrew shell", bins: ["shell"] }],
        },
        {
          key: "memory",
          name: "Memory Skill",
          source: "managed",
          disabled: false,
          eligible: true,
          config: { env: {} },
        },
      ],
    });
    apiMocks.updateSkill.mockResolvedValue({ ok: true, config: { apiKey: "next-key" } });
    apiMocks.installSkill.mockResolvedValue({ ok: true, installed: "shell" });
    apiMocks.fetchAgentSubagentConfig.mockResolvedValue({
      agentId: "main",
      allowAgents: ["builder"],
      allowAny: false,
      model: "gpt-5.4-mini",
      effectiveMaxSpawnDepth: 2,
      effectiveMaxChildrenPerAgent: 4,
      allowedAgents: [{ id: "builder", name: "Builder Agent" }],
      allAgents: [
        { id: "main", name: "Main Agent" },
        { id: "builder", name: "Builder Agent" },
      ],
      configHash: "sub-hash-1",
    });
    apiMocks.fetchSubagentRuns.mockResolvedValue({
      total: 1,
      runs: [
        {
          runId: "run-main-1",
          childSessionKey: "agent:builder:child",
          childAgentId: "builder",
          childAgentName: "Builder Agent",
          requesterSessionKey: "agent:main:latest",
          requesterAgentId: "main",
          requesterAgentName: "Main Agent",
          task: "Inspect repo",
          label: "Repo check",
          model: "gpt-5.4-mini",
          spawnMode: "delegated",
          depth: 1,
          createdAt: 123,
          status: "active",
        },
      ],
    });
    apiMocks.fetchRoutingBindings.mockResolvedValue({
      defaultAgentId: "main",
      dmScope: "account",
      configHash: "routing-hash-1",
      bindings: [
        {
          id: "route-main",
          agentId: "main",
          tier: "peer",
          match: {
            channel: "telegram",
            accountId: "acct-main",
            peer: { kind: "direct", id: "peer-main" },
          },
        },
      ],
    });
    apiMocks.fetchAgentToolPolicyPreview.mockResolvedValue({
      layers: [
        { label: "defaults", ruleCount: 2, effect: "allow" },
        { label: "agent", ruleCount: 1, effect: "deny" },
      ],
      tools: [
        { name: "read_file", allowed: true, decisiveLayer: "defaults", trace: [] },
        {
          name: "write_file",
          allowed: false,
          decisiveLayer: "agent",
          trace: [
            { layer: "defaults", decision: "allow" },
            { layer: "agent", decision: "deny" },
          ],
        },
      ],
      configHash: "policy-hash-1",
    });
    apiMocks.fetchAgentSystemPromptPreview.mockResolvedValue({
      layers: [{ label: "base", source: "file", charCount: 120, fileCount: 1 }],
      bootstrapFiles: [{ name: "AGENTS.md", exists: true, charCount: 120 }],
      totalChars: 120,
      configHash: "prompt-hash-1",
    });
    apiMocks.fetchToolsCatalog.mockResolvedValue({
      agentId: "main",
      profiles: [{ id: "coding", label: "Coding" }],
      groups: [
        {
          id: "core",
          label: "Core tools",
          source: "core",
          tools: [
            {
              id: "read_file",
              label: "Read file",
              description: "Read a file",
              source: "core",
              defaultProfiles: ["coding"],
            },
            {
              id: "write_file",
              label: "Write file",
              description: "Write a file",
              source: "core",
              defaultProfiles: ["coding"],
            },
          ],
        },
      ],
    });
    apiMocks.fetchSessions.mockResolvedValue({
      sessions: [
        {
          key: "agent:main:latest",
          agentId: "main",
          kind: "direct",
          model: "gpt-5.4",
          status: "active",
          title: "Latest main session",
          updatedAt: 200,
        },
        {
          key: "agent:main:older",
          agentId: "main",
          kind: "group",
          model: "gpt-5.4-mini",
          status: "idle",
          title: "Older main session",
          updatedAt: 100,
        },
        {
          key: "agent:main:subagent:depth=2:parent=main",
          agentId: "main",
          kind: "direct",
          model: "gpt-5.4-mini",
          status: "active",
          title: "Child subagent session",
          updatedAt: 50,
        },
      ],
    });
    apiMocks.fetchEffectiveTools.mockResolvedValue({
      agentId: "main",
      profile: "coding",
      groups: [
        {
          id: "core",
          label: "Core effective",
          source: "core",
          tools: [
            { id: "read_file", label: "Read file", source: "core" },
            { id: "write_file", label: "Write file", source: "core" },
          ],
        },
      ],
    });
    apiMocks.fetchAgentFiles.mockResolvedValue({
      agentId: "main",
      workspace: "/repo",
      files: [
        {
          name: "AGENTS.md",
          path: "/repo/AGENTS.md",
          missing: false,
          size: 15,
          updatedAtMs: 123,
        },
        {
          name: "CLAUDE.md",
          path: "/repo/CLAUDE.md",
          missing: true,
        },
        {
          name: "notes.md",
          path: "/repo/notes.md",
          missing: false,
          size: 12,
          updatedAtMs: 234,
        },
      ],
    });
    apiMocks.fetchAgentIdentity.mockResolvedValue({
      agentId: "main",
      name: "Main Identity",
      emoji: "MI",
      avatar: "https://example.test/main.png",
    });
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: {
        model: "sonnet-4.6",
        reasoningDefault: "stream",
        fastModeDefault: false,
        thinkingDefault: "adaptive",
        params: { temperature: 0.2 },
      },
      entry: {
        id: "main",
        model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
        reasoningDefault: "on",
        fastModeDefault: true,
        thinkingDefault: "adaptive",
        params: { temperature: 0.3 },
      },
      list: [
        {
          id: "main",
          model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
          reasoningDefault: "on",
          fastModeDefault: true,
          thinkingDefault: "adaptive",
          params: { temperature: 0.3 },
        },
      ],
      baseHash: "config-hash-1",
    });
    apiMocks.fetchAgentFile.mockImplementation(async (_agentId: string, name: string) => ({
      agentId: "main",
      workspace: "/repo",
      file: {
        name,
        path: `/repo/${name}`,
        missing: false,
        size: 15,
        updatedAtMs: 123,
        content: name === "notes.md" ? "Notes prompt" : "Existing prompt",
      },
    }));
    apiMocks.createAgent.mockResolvedValue({ ok: true, id: "builder2" });
    apiMocks.updateAgent.mockResolvedValue({ ok: true, id: "builder" });
    apiMocks.removeRoutingBinding.mockResolvedValue({
      ok: true,
      removed: {
        id: "route-main",
        agentId: "main",
        tier: "peer",
        match: { channel: "telegram" },
      },
      configHash: "routing-hash-2",
      impact: "messages fall through",
    });
    apiMocks.updateAgentEventStreams.mockResolvedValue({
      ok: true,
      agentId: "main",
      eventStreams: ["assistant", "lifecycle", "thinking"],
      configHash: "hash-2",
    });
    apiMocks.updateAgentSkills.mockResolvedValue({
      ok: true,
      agentId: "main",
      mode: "whitelist",
      skills: ["memory", "shell"],
      configHash: "skills-hash-2",
    });
    apiMocks.saveAgentFile.mockResolvedValue({
      ok: true,
      agentId: "main",
      workspace: "/repo",
      file: {
        name: "AGENTS.md",
        path: "/repo/AGENTS.md",
        missing: false,
        size: 14,
        updatedAtMs: 456,
        content: "Updated prompt",
      },
    });
    apiMocks.updateAgentSubagentConfig.mockResolvedValue({
      ok: true,
      agentId: "main",
      allowAgents: ["*"],
      model: "gpt-5.4",
      configHash: "sub-hash-2",
    });
    apiMocks.updateAgentRawConfig.mockResolvedValue({
      ok: true,
      hash: "config-hash-2",
    });
    apiMocks.deleteAgent.mockResolvedValue({ ok: true, id: "builder" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    window.history.replaceState({}, "", "/");
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads agents, sorts the list, and selects the default agent detail", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));
    await waitFor(() => expect(apiMocks.fetchAgentEventStreams).toHaveBeenCalledWith("main"));
    await waitFor(() => expect(apiMocks.fetchAgentSkills).toHaveBeenCalledWith("main"));
    await waitFor(() => expect(apiMocks.fetchAgentSubagentConfig).toHaveBeenCalledWith("main"));
    await waitFor(() =>
      expect(apiMocks.fetchSubagentRuns).toHaveBeenCalledWith({
        requesterAgentId: "main",
        status: "active",
      }),
    );
    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({ agentId: "main" }),
    );
    await waitFor(() => expect(apiMocks.fetchAgentToolPolicyPreview).toHaveBeenCalledWith("main"));
    await waitFor(() =>
      expect(apiMocks.fetchAgentSystemPromptPreview).toHaveBeenCalledWith("main"),
    );
    await waitFor(() => expect(apiMocks.fetchToolsCatalog).toHaveBeenCalledWith("main"));
    await waitFor(() =>
      expect(apiMocks.fetchSessions).toHaveBeenCalledWith({ agentId: "main", limit: 25 }),
    );
    await waitFor(() =>
      expect(apiMocks.fetchEffectiveTools).toHaveBeenCalledWith({
        agentId: "main",
        sessionKey: "agent:main:latest",
      }),
    );
    await waitFor(() => expect(apiMocks.fetchAgentFiles).toHaveBeenCalledWith("main"));
    await waitFor(() => expect(apiMocks.fetchAgentIdentity).toHaveBeenCalledWith("main"));
    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));

    const agentButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".deckgo-shell-list button"),
    );
    expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Agents ready");
    expect(container.querySelector(".deck-ui-agents")).toBeTruthy();
    expect(container.querySelector('[data-agent-boundary="list"]')).toBeTruthy();
    expect(container.querySelector('[data-agent-boundary="detail"]')).toBeTruthy();
    expect(container.querySelector('[data-agent-boundary="compare"]')).toBeTruthy();
    for (const editor of [
      "template-dialog",
      "config-editor",
      "skill-config",
      "skill-install-dialog",
      "skill-config-editor",
      "tools-editor",
      "tool-policy-trace",
      "prompt-preview",
      "files-browser",
    ]) {
      expect(container.querySelector(`[data-agent-editor="${editor}"]`)).toBeTruthy();
    }
    expect(container.querySelectorAll(".deck-ui-agents-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-agents-body")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-agents-tabs")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-agents-tabs [role='tab']")).toHaveLength(8);
    const tabLabels = Array.from(
      container.querySelectorAll(".deck-ui-agents-tabs [role='tab']"),
    ).map((tab) => tab.textContent);
    expect([
      ["Overview", "Config", "Routing", "Skills", "Tools", "Context", "Subagent", "Sessions"],
      ["概览", "配置", "路由", "Skills", "工具", "上下文", "子智能体", "会话"],
    ]).toContainEqual(tabLabels);
    expect(container.querySelectorAll(".deck-ui-agents-surface").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".deck-ui-agents-hero").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".deck-ui-agents-row").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll(".deck-ui-agents-input").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".deck-ui-agents-button").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.textContent).toContain("2 loaded");
    expect(container.textContent).toContain("Agent batch summary");
    expect(container.querySelector('[aria-label="Agent batch export"]')?.textContent).toBe(
      [
        "name | id | model | status",
        "Builder Agent | builder | gpt-5.4 | busy",
        "Main Agent | main | sonnet-4.6 | idle",
      ].join("\n"),
    );
    expect(agentButtons[0]?.textContent).toContain("Builder Agent");
    expect(agentButtons[1]?.textContent).toContain("Main Agent");
    expect(container.textContent).toContain("default main");
    expect(container.textContent).toContain("Selected agent");
    expect(container.textContent).toContain("Main Agent");
    expect(container.textContent).toContain("sonnet-4.6");
    expect(container.textContent).toContain("Channel event streams");
    expect(container.textContent).toContain("Using default event stream policy.");
    expect(container.textContent).toContain("chat locked on");
    expectTextOneOf("Agent skills", "智能体技能");
    expect(container.textContent).toContain("Shell Skill");
    expect(container.textContent).toContain("Memory Skill");
    expect(container.textContent).toContain("Subagent spawning");
    expect(container.textContent).toContain("Agent subagent runs");
    expect(container.textContent).toContain("run-main-1");
    expect(container.textContent).toContain("Inspect repo");
    expect(container.textContent).toContain("Agent routing bindings");
    expect(container.textContent).toContain("route-main");
    expect(container.textContent).toContain("peer direct:peer-main");
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>("input")).some(
        (input) => input.value === "gpt-5.4-mini",
      ),
    ).toBe(true);
    expect(container.textContent).toContain("Effective previews");
    expect(container.textContent).toContain("allowed tools");
    expect(container.textContent).toContain("1/2");
    expect(container.textContent).toContain("Tool policy trace");
    expect(container.textContent).toContain("write_file");
    expect(container.textContent).toContain("Tools catalog");
    expect(container.textContent).toContain("Core tools: 2");
    expect(container.textContent).toContain("Session effective tools");
    expect(container.textContent).toContain("Core effective: 2");
    expect(container.textContent).toContain("Recent agent sessions");
    expect(container.textContent).toContain("Latest main session");
    expect(container.textContent).toContain("3/3");
    expect(container.textContent).toContain("AGENTS.md");
    expect(container.textContent).toContain("present | 120 chars");
    expect(container.textContent).toContain("Edit bootstrap file");
    expect(container.textContent).toContain("Agent files");
    expect(container.textContent).toContain("CLAUDE.md");
    expect(container.textContent).toContain("Agent identity");
    expect(container.textContent).toContain("Main Identity");
    expect(container.textContent).toContain("avatar configured");
    expect(container.textContent).toContain("Agent runtime profile");
    expect(container.textContent).toContain("sandbox enabled");
    expect(container.textContent).toContain("active runs");
    expect(container.textContent).toContain("metrics");
    expect(container.textContent).toContain("backend docker");
    expect(container.textContent).toContain("filesystem restricted");
    expect(container.textContent).toContain("fallback gpt-5.4-mini");
    expect(container.textContent).toContain("Agent config overrides");
    expect(container.textContent).toContain("config-hash-1");
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>("input")).some(
        (input) => input.value === "gpt-5.4",
      ),
    ).toBe(true);

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open agent routing")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToRouting).toHaveBeenCalledWith(deckUIMocks.ui, "main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open subagents panel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToPanel).toHaveBeenCalledWith(deckUIMocks.ui, "subagents");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open child agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "builder",
      "subagents",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open child session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(
      deckUIMocks.ui,
      "agent:builder:child",
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenLastCalledWith(
      deckUIMocks.ui,
      "agent:main:latest",
    );
  });

  it("renders the restored Agents shell with Chinese UI copy", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel("zh");
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));
    expect(container.textContent).toContain("智能体清单");
    expect(container.textContent).toContain("智能体批量摘要");
    expect(container.textContent).toContain("智能体技能");
    expect(container.textContent).toContain("安装选项");
    expect(container.textContent).toContain("技能配置");
    expect(container.textContent).toContain("子智能体生成");
    expect(container.textContent).toContain("生效预览");
    expect(container.textContent).toContain("智能体文件");
  });

  it("selects the agent and detail tab requested by cross-panel navigation params", async () => {
    window.history.replaceState(
      {},
      "",
      "/?surface=deck-ui&panel=agents&agentId=builder&agentTab=skills",
    );

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder"));

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Builder Agent");
    expect(
      container.querySelector<HTMLButtonElement>(".deck-ui-agents-tabs button.is-active")
        ?.textContent,
    ).toBe("Skills");
    expect(container.textContent).toContain("Selected agent");
    expect(container.textContent).toContain("gpt-5.4");
  });

  it("shows SSE-backed live agent metrics", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentHealthSnapshot).toHaveBeenCalled());
    await waitFor(() => expect(latestStreamParams).toBeTruthy());

    await act(async () => {
      latestStreamParams?.onEvent({
        event: "activity.event",
        data: JSON.stringify({ agentId: "main", type: "chat" }),
      });
      latestStreamParams?.onEvent({
        event: "agent.status.changed",
        data: JSON.stringify({ agentId: "main", status: "busy" }),
      });
    });

    const stats = Array.from(container.querySelectorAll<HTMLElement>(".deckgo-stat"));
    const readStat = (label: string) =>
      stats
        .find((stat) => stat.querySelector(".deckgo-stat-label")?.textContent === label)
        ?.querySelector(".deckgo-stat-value")?.textContent;
    expect(readStat("active runs")).toBe("3");
    expect(readStat("messages")).toBe("1");
    expect(readStat("metrics")).toBe("live");
  });

  it("compares two Gateway-backed agent detail payloads", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));

    const compareSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Compare agent"]',
    );
    expect(compareSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(compareSelect as HTMLSelectElement, { target: { value: "builder" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Compare agents")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder"));
    expect(container.textContent).toContain("Agent compare");
    expect(container.textContent).toContain("right");
    expect(container.textContent).toContain("builder");
    expect(container.textContent).toContain("change: model");
    expect(container.textContent).toContain("old: sonnet-4.6 | new: gpt-5.4");
  });

  it("loads and updates Gateway-backed agent event stream settings", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentEventStreams).toHaveBeenCalledWith("main"));

    const thinkingRow = Array.from(container.querySelectorAll<HTMLLabelElement>("label")).find(
      (label) => label.textContent?.toLowerCase() === "thinking",
    );
    const thinkingToggle = thinkingRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(thinkingToggle).toBeTruthy();
    expect(thinkingToggle?.checked).toBe(false);

    await act(async () => {
      fireEvent.click(thinkingToggle as HTMLInputElement);
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentEventStreams).toHaveBeenCalledWith(
        "main",
        ["assistant", "lifecycle", "thinking"],
        "hash-1",
      ),
    );
    expect(container.textContent).toContain("thinking");
    expect(container.textContent).toContain("Last agent action");
  });

  it("loads and saves raw agent config overrides through the config patch path", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));

    const modelInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.value === "gpt-5.4",
    );
    expect(modelInput).toBeTruthy();
    const reasoningSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>("select"),
    ).find((select) => Array.from(select.options).some((option) => option.value === "off"));
    expect(reasoningSelect).toBeTruthy();
    expect(reasoningSelect?.value).toBe("on");
    const thinkingSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => Array.from(select.options).some((option) => option.value === "xhigh"),
    );
    expect(thinkingSelect).toBeTruthy();
    expect(thinkingSelect?.value).toBe("adaptive");
    const fastModeRow = Array.from(container.querySelectorAll<HTMLLabelElement>("label")).find(
      (label) => label.textContent?.includes("Fast mode default"),
    );
    const fastModeToggle = fastModeRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(fastModeToggle).toBeTruthy();
    expect(fastModeToggle?.checked).toBe(true);
    const temperatureInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "inherit temperature",
    );
    expect(temperatureInput?.value).toBe("0.3");

    await act(async () => {
      fireEvent.change(modelInput as HTMLInputElement, {
        target: { value: " gpt-5.4-mini " },
      });
      fireEvent.change(reasoningSelect as HTMLSelectElement, { target: { value: "off" } });
      fireEvent.change(thinkingSelect as HTMLSelectElement, { target: { value: "high" } });
      fireEvent.click(fastModeToggle as HTMLInputElement);
      fireEvent.change(temperatureInput as HTMLInputElement, { target: { value: "0.6" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
          reasoningDefault: "on",
          fastModeDefault: true,
          thinkingDefault: "adaptive",
          params: { temperature: 0.3 },
        },
        updates: {
          model: {
            primary: "gpt-5.4-mini",
            fallbacks: ["gpt-5.4-mini"],
          },
          reasoningDefault: "off",
          fastModeDefault: false,
          thinkingDefault: "high",
          params: { temperature: 0.6 },
        },
        baseHash: "config-hash-1",
      }),
    );
    expect(container.textContent).toContain("Last agent action");
  });

  it("reorders and removes fallback models before saving raw agent config", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: { model: "sonnet-4.6" },
      entry: {
        id: "main",
        model: {
          primary: "gpt-5.4",
          fallbacks: ["gpt-5.4-mini", "gpt-5.4-tiny", "gpt-5.4-nano"],
        },
      },
      list: [
        {
          id: "main",
          model: {
            primary: "gpt-5.4",
            fallbacks: ["gpt-5.4-mini", "gpt-5.4-tiny", "gpt-5.4-nano"],
          },
        },
      ],
      baseHash: "config-hash-fallbacks",
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));
    expect(container.textContent).toContain("#2 gpt-5.4-tiny");

    const tinyCard = Array.from(
      container.querySelectorAll<HTMLElement>(".deckgo-selectable-card"),
    ).find((card) => card.textContent?.includes("#2 gpt-5.4-tiny"));
    expect(tinyCard).toBeTruthy();
    await act(async () => {
      Array.from(tinyCard?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Move up")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nanoCard = Array.from(
      container.querySelectorAll<HTMLElement>(".deckgo-selectable-card"),
    ).find((card) => card.textContent?.includes("#3 gpt-5.4-nano"));
    expect(nanoCard).toBeTruthy();
    await act(async () => {
      Array.from(nanoCard?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Remove fallback")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          model: {
            primary: "gpt-5.4",
            fallbacks: ["gpt-5.4-mini", "gpt-5.4-tiny", "gpt-5.4-nano"],
          },
        },
        updates: {
          model: {
            primary: "gpt-5.4",
            fallbacks: ["gpt-5.4-tiny", "gpt-5.4-mini"],
          },
        },
        baseHash: "config-hash-fallbacks",
      }),
    );
  });

  it("selects runtime configured model presets for primary and fallback models", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: { model: "sonnet-4.6" },
      entry: {
        id: "main",
        model: { primary: "legacy/model", fallbacks: [] },
      },
      list: [
        {
          id: "main",
          model: { primary: "legacy/model", fallbacks: [] },
        },
      ],
      baseHash: "config-hash-runtime-models",
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchRuntimeConfiguredModels).toHaveBeenCalled());
    const primaryPreset = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Primary model preset"]',
    );
    const fallbackPreset = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Add fallback model"]',
    );
    expect(primaryPreset).toBeTruthy();
    expect(fallbackPreset).toBeTruthy();

    await act(async () => {
      fireEvent.change(primaryPreset as HTMLSelectElement, {
        target: { value: "openai/gpt-5.4-mini" },
      });
      fireEvent.change(fallbackPreset as HTMLSelectElement, {
        target: { value: "anthropic/claude-4.6" },
      });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          model: { primary: "legacy/model", fallbacks: [] },
        },
        updates: {
          model: {
            primary: "openai/gpt-5.4-mini",
            fallbacks: ["anthropic/claude-4.6"],
          },
        },
        baseHash: "config-hash-runtime-models",
      }),
    );
  });

  it("rejects out-of-range temperature before saving raw agent config", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));
    const temperatureInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "inherit temperature",
    );
    expect(temperatureInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(temperatureInput as HTMLInputElement, { target: { value: "3" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("temperature must be between 0 and 2");
    expect(apiMocks.updateAgentRawConfig).not.toHaveBeenCalled();
  });

  it("saves raw tool profile and policy overrides through the config patch path", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: {
        model: "sonnet-4.6",
        tools: { profile: "coding", allow: [], deny: [] },
      },
      entry: {
        id: "main",
        tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
      },
      list: [
        {
          id: "main",
          tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
        },
      ],
      baseHash: "config-hash-tools",
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));

    const profileInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "inherit tools profile",
    );
    const allowInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "comma-separated allow overrides",
    );
    const denyInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "comma-separated deny overrides",
    );
    expect(profileInput?.value).toBe("coding");
    expect(allowInput?.value).toBe("read_file");
    expect(denyInput?.value).toBe("write_file");

    await act(async () => {
      fireEvent.change(profileInput as HTMLInputElement, { target: { value: "research" } });
      fireEvent.change(allowInput as HTMLInputElement, {
        target: { value: "read_file, search_docs" },
      });
      fireEvent.change(denyInput as HTMLInputElement, { target: { value: "" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
        },
        updates: {
          tools: {
            profile: "research",
            allow: ["read_file", "search_docs"],
            deny: null,
          },
        },
        baseHash: "config-hash-tools",
      }),
    );
  });

  it("selects a Gateway-reported tools profile preset before saving raw config", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: {
        model: "sonnet-4.6",
        tools: { profile: "coding", allow: [], deny: [] },
      },
      entry: {
        id: "main",
        tools: { profile: "coding" },
      },
      list: [
        {
          id: "main",
          tools: { profile: "coding" },
        },
      ],
      baseHash: "config-hash-profile",
    });
    apiMocks.fetchToolsCatalog.mockResolvedValue({
      agentId: "main",
      profiles: [
        { id: "coding", label: "Coding" },
        { id: "research", label: "Research" },
      ],
      groups: [],
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchToolsCatalog).toHaveBeenCalledWith("main"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Research")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          tools: { profile: "coding" },
        },
        updates: {
          tools: { profile: "research" },
        },
        baseHash: "config-hash-profile",
      }),
    );
  });

  it("updates raw tool allow and deny overrides from the tools catalog selector", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: {
        model: "sonnet-4.6",
        tools: { profile: "coding", allow: [], deny: [] },
      },
      entry: {
        id: "main",
        tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
      },
      list: [
        {
          id: "main",
          tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
        },
      ],
      baseHash: "config-hash-tools",
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchToolsCatalog).toHaveBeenCalledWith("main"));

    const readOverride = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Tool override read_file"]',
    );
    const writeOverride = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Tool override write_file"]',
    );
    expect(readOverride?.value).toBe("allow");
    expect(writeOverride?.value).toBe("deny");

    await act(async () => {
      fireEvent.change(writeOverride as HTMLSelectElement, { target: { value: "allow" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save agent config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          tools: { profile: "coding", allow: ["read_file"], deny: ["write_file"] },
        },
        updates: {
          tools: {
            allow: ["read_file", "write_file"],
            deny: null,
          },
        },
        baseHash: "config-hash-tools",
      }),
    );
  });

  it("resets editable raw agent config overrides back to inheritance", async () => {
    apiMocks.fetchAgentRawConfig.mockResolvedValue({
      agentId: "main",
      defaults: {
        model: "sonnet-4.6",
        reasoningDefault: "stream",
        fastModeDefault: false,
        thinkingDefault: "adaptive",
        params: { temperature: 0.2 },
        tools: { profile: "coding", allow: [], deny: [] },
      },
      entry: {
        id: "main",
        model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
        reasoningDefault: "on",
        fastModeDefault: true,
        thinkingDefault: "high",
        params: { temperature: 0.3 },
        tools: { profile: "research", allow: ["read_file"], deny: ["write_file"] },
      },
      list: [
        {
          id: "main",
          model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
          reasoningDefault: "on",
          fastModeDefault: true,
          thinkingDefault: "high",
          params: { temperature: 0.3 },
          tools: { profile: "research", allow: ["read_file"], deny: ["write_file"] },
        },
      ],
      baseHash: "config-hash-reset",
    });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Reset editable overrides")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("main", {
        entry: {
          id: "main",
          model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
          reasoningDefault: "on",
          fastModeDefault: true,
          thinkingDefault: "high",
          params: { temperature: 0.3 },
          tools: { profile: "research", allow: ["read_file"], deny: ["write_file"] },
        },
        updates: {
          model: null,
          thinkingDefault: null,
          reasoningDefault: null,
          fastModeDefault: null,
          params: { temperature: null },
          tools: { profile: null, allow: null, deny: null },
        },
        baseHash: "config-hash-reset",
      }),
    );
  });

  it("loads and updates Gateway-backed agent skill settings", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentSkills).toHaveBeenCalledWith("main"));

    const modeSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => Array.from(select.options).some((option) => option.value === "whitelist"),
    );
    expect(modeSelect).toBeTruthy();
    expect(modeSelect?.value).toBe("whitelist");

    const memoryRow = Array.from(container.querySelectorAll<HTMLLabelElement>("label")).find(
      (label) => label.textContent?.includes("Memory Skill"),
    );
    const memoryToggle = memoryRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(memoryToggle).toBeTruthy();
    expect(memoryToggle?.checked).toBe(false);

    await act(async () => {
      fireEvent.click(memoryToggle as HTMLInputElement);
    });
    await act(async () => {
      findButtonByText("Save agent skills", "保存智能体技能")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentSkills).toHaveBeenCalledWith("main", {
        mode: "whitelist",
        skills: ["memory", "shell"],
        baseHash: "skills-hash-1",
      }),
    );
    expect(container.textContent).toContain("Last agent action");
  });

  it("restores skill install and API/env config controls inside the agent editor", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledWith("main"));
    expect(container.querySelector('[data-agent-editor="skill-install-dialog"]')).toBeTruthy();
    expect(container.querySelector('[data-agent-editor="skill-config-editor"]')).toBeTruthy();
    expect(container.textContent).toContain("Homebrew shell");

    const apiKeyInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.type === "password",
    );
    expect(apiKeyInput).toBeTruthy();
    expect(apiKeyInput?.value).toBe("shell-key");

    await act(async () => {
      fireEvent.change(apiKeyInput as HTMLInputElement, { target: { value: "next-key" } });
    });

    const envValueInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.value === "safe",
    );
    expect(envValueInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(envValueInput as HTMLInputElement, { target: { value: "strict" } });
    });

    await act(async () => {
      findButtonByText("Save skill config", "保存技能配置")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenCalledWith("shell", {
        apiKey: "next-key",
        env: { SHELL_MODE: "strict" },
      }),
    );

    await waitFor(() => expect(findButtonByText("Homebrew shell")?.disabled).toBe(false));

    await act(async () => {
      findButtonByText("Homebrew shell")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.installSkill).toHaveBeenCalledWith("Shell Skill", "brew-shell"),
    );
  });

  it("loads and saves Gateway-backed bootstrap prompt files", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchAgentSystemPromptPreview).toHaveBeenCalledWith("main"),
    );

    const bootstrapButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Edit bootstrap file"),
    );
    expect(bootstrapButton).toBeTruthy();

    await act(async () => {
      bootstrapButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchAgentFile).toHaveBeenCalledWith("main", "AGENTS.md"));
    expect(container.querySelector('[data-agent-editor="bootstrap-file-editor"]')).toBeTruthy();

    const editor = container.querySelector<HTMLTextAreaElement>("textarea.deckgo-textarea");
    expect(editor).toBeTruthy();
    expect(editor?.value).toBe("Existing prompt");

    await act(async () => {
      editor?.setSelectionRange(0, 0);
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "{{agentId}}")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(editor?.value).toBe("{{agentId}}Existing prompt");

    await act(async () => {
      fireEvent.change(editor as HTMLTextAreaElement, { target: { value: "Updated prompt" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save bootstrap file")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.saveAgentFile).toHaveBeenCalledWith("main", "AGENTS.md", "Updated prompt"),
    );
    expect(container.textContent).toContain("Last agent action");
  });

  it("loads effective tools for the selected agent session", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchEffectiveTools).toHaveBeenCalledWith({
        agentId: "main",
        sessionKey: "agent:main:latest",
      }),
    );

    const sessionSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => Array.from(select.options).some((option) => option.value === "agent:main:older"),
    );
    expect(sessionSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(sessionSelect as HTMLSelectElement, {
        target: { value: "agent:main:older" },
      });
    });

    await waitFor(() =>
      expect(apiMocks.fetchEffectiveTools).toHaveBeenCalledWith({
        agentId: "main",
        sessionKey: "agent:main:older",
      }),
    );
  });

  it("filters recent agent sessions by kind and subagent key metadata", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Recent agent sessions"));

    const filterSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => select.getAttribute("aria-label") === "Agent session filter",
    );
    expect(filterSelect).toBeTruthy();
    expect(container.textContent).toContain("Latest main session");
    expect(container.textContent).toContain("Older main session");
    expect(container.textContent).toContain("Child subagent session");

    await act(async () => {
      fireEvent.change(filterSelect as HTMLSelectElement, { target: { value: "group" } });
    });

    const recentSessionsTile = Array.from(container.querySelectorAll(".deckgo-surface-tile")).find(
      (tile) =>
        Array.from(tile.children).some(
          (child) =>
            child.classList.contains("deckgo-surface-label") &&
            child.textContent === "Recent agent sessions",
        ),
    );
    expect(recentSessionsTile).toBeTruthy();
    expect(recentSessionsTile?.textContent).toContain("1/3");
    expect(recentSessionsTile?.textContent).toContain("Older main session");
    expect(recentSessionsTile?.textContent).not.toContain("Latest main session");
    expect(recentSessionsTile?.textContent).not.toContain("Child subagent session");

    await act(async () => {
      fireEvent.change(filterSelect as HTMLSelectElement, { target: { value: "subagent" } });
    });

    expect(recentSessionsTile?.textContent).toContain("Child subagent session");
    expect(recentSessionsTile?.textContent).toContain("subagent | depth 2 | parent main");
    expect(recentSessionsTile?.textContent).not.toContain("Older main session");
  });

  it("filters and expands Gateway-backed tool policy trace entries", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentToolPolicyPreview).toHaveBeenCalledWith("main"));

    const searchInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "search tools",
    );
    expect(searchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "write" } });
    });

    const writeToolButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("write_file"),
    );
    expect(writeToolButton).toBeTruthy();

    await act(async () => {
      writeToolButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("defaults -> allow | agent -> deny");
  });

  it("opens files from the Gateway-backed agent files list", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentFiles).toHaveBeenCalledWith("main"));

    const fileButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("notes.md"),
    );
    expect(fileButton).toBeTruthy();
    await waitFor(() => expect(fileButton?.disabled).toBe(false));

    await act(async () => {
      fileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchAgentFile).toHaveBeenCalledWith("main", "notes.md"));
    const editor = container.querySelector<HTMLTextAreaElement>("textarea.deckgo-textarea");
    expect(editor?.value).toBe("Notes prompt");
  });

  it("loads and updates Gateway-backed subagent spawn settings", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentSubagentConfig).toHaveBeenCalledWith("main"));

    const modeSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => Array.from(select.options).some((option) => option.value === "any"),
    );
    expect(modeSelect).toBeTruthy();
    expect(modeSelect?.value).toBe("list");

    const modelInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "inherit default model",
    );
    expect(modelInput).toBeTruthy();
    const modelPreset = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Subagent model preset"]',
    );
    expect(modelPreset).toBeTruthy();

    await act(async () => {
      fireEvent.change(modeSelect as HTMLSelectElement, { target: { value: "any" } });
      fireEvent.change(modelPreset as HTMLSelectElement, {
        target: { value: "anthropic/claude-4.6" },
      });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save subagents")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgentSubagentConfig).toHaveBeenCalledWith("main", {
        allowAgents: ["*"],
        model: "anthropic/claude-4.6",
        baseHash: "sub-hash-1",
      }),
    );
    expect(container.textContent).toContain("Last agent action");
  });

  it("clones the selected agent with supported raw config overrides", async () => {
    const sourceRawConfig = {
      agentId: "main",
      defaults: {},
      entry: {
        id: "main",
        model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
        reasoningDefault: "on",
        fastModeDefault: true,
        thinkingDefault: "adaptive",
        params: { temperature: 0.3 },
      },
      list: [],
      baseHash: "source-hash",
    };
    apiMocks.fetchAgentsList
      .mockResolvedValueOnce(agentsList())
      .mockResolvedValue(agentsList(true));
    apiMocks.fetchAgentRawConfig.mockImplementation(async (agentId: string) =>
      agentId === "builder2"
        ? {
            agentId: "builder2",
            defaults: {},
            entry: { id: "builder2" },
            list: [{ id: "builder2" }],
            baseHash: "clone-hash",
          }
        : sourceRawConfig,
    );
    apiMocks.createAgent.mockResolvedValueOnce({ ok: true, id: "builder2" });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("main"));

    const cloneInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "clone name",
    );
    expect(cloneInput).toBeTruthy();
    expect(cloneInput?.value).toBe("Main Agent Copy");

    await act(async () => {
      fireEvent.change(cloneInput as HTMLInputElement, { target: { value: " Main Clone " } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Clone selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createAgent).toHaveBeenCalledWith({
        name: "Main Clone",
        workspace: "/repo",
      }),
    );
    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("builder2"));
    expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("builder2", {
      entry: { id: "builder2" },
      updates: {
        model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
        reasoningDefault: "on",
        fastModeDefault: true,
        thinkingDefault: "adaptive",
        params: { temperature: 0.3 },
      },
      baseHash: "clone-hash",
    });
    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder2"));
  });

  it("removes an agent-scoped routing binding with the loaded routing config hash", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() =>
      expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledWith({ agentId: "main" }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Remove routing binding")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.removeRoutingBinding).toHaveBeenCalledWith({
        id: "route-main",
        baseHash: "routing-hash-1",
      }),
    );
    expect(apiMocks.fetchRoutingBindings).toHaveBeenCalledTimes(2);
  });

  it("saves and deletes local agent templates using the legacy template storage key", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234_567);
    localStorage.setItem(
      "openclaw-deck-agent-templates",
      JSON.stringify([
        {
          name: "Existing Template",
          createdAt: 1_000,
          config: { model: "sonnet-4.6" },
        },
      ]),
    );

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));
    expect(container.textContent).toContain("Existing Template");

    const templateInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.placeholder === "template name",
    );
    expect(templateInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(templateInput as HTMLInputElement, { target: { value: " Main Template " } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save template")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const storedTemplates = JSON.parse(
      localStorage.getItem("openclaw-deck-agent-templates") ?? "[]",
    ) as Array<{ name: string; createdAt: number; config: Record<string, unknown> }>;
    expect(storedTemplates).toHaveLength(2);
    expect(storedTemplates[1]).toEqual({
      name: "Main Template",
      createdAt: 1_234_567,
      config: { model: "sonnet-4.6", emoji: "MI" },
    });
    expect(container.textContent).toContain("Main Template");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete template")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const afterDelete = JSON.parse(
      localStorage.getItem("openclaw-deck-agent-templates") ?? "[]",
    ) as Array<{ name: string }>;
    expect(afterDelete).toEqual([
      {
        name: "Main Template",
        createdAt: 1_234_567,
        config: { model: "sonnet-4.6", emoji: "MI" },
      },
    ]);
  });

  it("creates an agent from a local template and applies supported raw config", async () => {
    localStorage.setItem(
      "openclaw-deck-agent-templates",
      JSON.stringify([
        {
          name: "Template Agent",
          createdAt: 1_000,
          config: {
            model: "gpt-5.4-mini",
            emoji: "TA",
            thinkingDefault: "turbo",
          },
        },
      ]),
    );
    apiMocks.fetchAgentsList
      .mockResolvedValueOnce(agentsList())
      .mockResolvedValue(agentsList(true));
    apiMocks.fetchAgentRawConfig.mockImplementation(async (agentId: string) =>
      agentId === "builder2"
        ? {
            agentId: "builder2",
            defaults: {},
            entry: { id: "builder2" },
            list: [{ id: "builder2" }],
            baseHash: "template-hash",
          }
        : {
            agentId: "main",
            defaults: {},
            entry: { id: "main" },
            list: [{ id: "main" }],
            baseHash: "source-hash",
          },
    );
    apiMocks.createAgent.mockResolvedValueOnce({ ok: true, id: "builder2" });

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));
    expect(container.textContent).toContain("Template Agent");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create from template")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createAgent).toHaveBeenCalledWith({
        name: "Template Agent",
        emoji: "TA",
      }),
    );
    await waitFor(() => expect(apiMocks.fetchAgentRawConfig).toHaveBeenCalledWith("builder2"));
    expect(apiMocks.updateAgentRawConfig).toHaveBeenCalledWith("builder2", {
      entry: { id: "builder2" },
      updates: { model: "gpt-5.4-mini" },
      baseHash: "template-hash",
    });
    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder2"));
  });

  it("loads selected details and runs create, rename, and delete actions through deck-go APIs", async () => {
    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder Agent"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder"));
    expect(container.textContent).toContain("gpt-5.4");

    const [createNameInput, createWorkspaceInput, createEmojiInput] = Array.from(
      container.querySelectorAll<HTMLInputElement>(".deckgo-surface-tile input"),
    );
    expect(createNameInput).toBeTruthy();
    expect(createWorkspaceInput).toBeTruthy();
    expect(createEmojiInput).toBeTruthy();
    apiMocks.fetchAgentsList.mockResolvedValue(agentsList(true));

    await act(async () => {
      fireEvent.change(createNameInput, { target: { value: " Builder Two " } });
      fireEvent.change(createWorkspaceInput, {
        target: { value: " /tmp/build " },
      });
      fireEvent.change(createEmojiInput, { target: { value: "BT" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createAgent).toHaveBeenCalledWith({
        name: "Builder Two",
        workspace: "/tmp/build",
        emoji: "BT",
      }),
    );
    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder2"));
    expect(container.textContent).toContain("Last agent action");

    const renameInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).at(-1);
    expect(renameInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(renameInput as HTMLInputElement, { target: { value: " Builder Renamed " } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Rename")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateAgent).toHaveBeenCalledWith("builder2", {
        name: "Builder Renamed",
      }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteAgent).toHaveBeenCalledWith("builder2"));
    expect(window.confirm).toHaveBeenCalledWith("Delete agent builder2?");
  });

  it("does not delete an agent when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      renderAgentsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("main"));

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Builder Agent"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchAgentDetail).toHaveBeenCalledWith("builder"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete agent builder?");
    expect(apiMocks.deleteAgent).not.toHaveBeenCalled();
  });
});
