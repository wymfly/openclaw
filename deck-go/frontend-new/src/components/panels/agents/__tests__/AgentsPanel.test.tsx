// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "@/data/testing/DataFabricTestProvider";
import { expectNoAxeViolations } from "@/design-system/atoms/__tests__/axe-helper";
import messages from "@/i18n/en.json";
import { useAgentsStore } from "@/stores/agents";
import { AgentsPanel } from "../AgentsPanel";

const api = vi.hoisted(() => ({
  createAgent: vi.fn(),
  deleteAgent: vi.fn(),
  fetchAgentDetail: vi.fn(),
  fetchAgentEventStreams: vi.fn(),
  fetchAgentFile: vi.fn(),
  fetchAgentFiles: vi.fn(),
  fetchAgentModelPolicy: vi.fn(),
  fetchAgentSkills: vi.fn(),
  fetchAgentSubagentConfig: vi.fn(),
  fetchAgentSystemPromptPreview: vi.fn(),
  fetchAgentToolPolicyPreview: vi.fn(),
  fetchAgentsList: vi.fn(),
  fetchRuntimeConfiguredModels: vi.fn(),
  normalizeAgentSubagentPermissionOptions: vi.fn(),
  saveAgentFile: vi.fn(),
  streamEvents: vi.fn(),
  updateAgent: vi.fn(),
  updateAgentEventStreams: vi.fn(),
  updateAgentModelPolicy: vi.fn(),
  updateAgentSkills: vi.fn(),
  updateAgentSubagentConfig: vi.fn(),
}));

vi.mock("@/api", () => ({
  ...api,
}));

let container: HTMLDivElement;
let root: Root | null;

const defaultAgents = [
  {
    id: "main",
    name: "Main",
    model: "gpt-5.4",
    workspace: "/workspace",
    status: "idle" as const,
    isDefault: true,
    isConfiguredDefault: true,
    isMainProtected: true,
    sessionCount: 2,
    bindingCount: 1,
  },
  {
    id: "ops",
    name: "Ops",
    model: "gpt-5.4-mini",
    workspace: "/ops",
    status: "busy" as const,
    isDefault: false,
    isConfiguredDefault: false,
    isMainProtected: false,
    sessionCount: 4,
    bindingCount: 2,
  },
];

function modelPolicyFixture(agentId = "main") {
  return {
    agentId,
    configHash: `${agentId}-policy-hash`,
    configuredModels: [
      {
        ref: "cpa/gpt-5.4",
        provider: "cpa",
        model: "gpt-5.4",
        name: "GPT 5.4",
      },
      {
        ref: "cpa/gpt-5.4-mini",
        provider: "cpa",
        model: "gpt-5.4-mini",
        name: "GPT 5.4 Mini",
      },
    ],
    policies: [
      {
        kind: "agent-model",
        key: "agent",
        label: "Agent runtime model",
        configPath: `agents.list[${agentId}].model`,
        source: agentId === "main" ? "default" : "agent",
        supportedShape: "agentModelConfig",
        selection: agentId === "main" ? undefined : { primary: "cpa/gpt-5.4-mini", fallbacks: [] },
        effective: {
          primary: agentId === "main" ? "cpa/gpt-5.4" : "cpa/gpt-5.4-mini",
          fallbacks: agentId === "main" ? ["cpa/gpt-5.4-mini"] : [],
        },
        unavailableRefs: [],
        editable: true,
        owner: "agents",
      },
      {
        kind: "agent-subagents",
        key: "agentSubagents",
        label: "Agent subagent model",
        configPath: `agents.list[${agentId}].subagents.model`,
        source: "default",
        supportedShape: "agentModelConfig",
        effective: { primary: "cpa/gpt-5.4-mini", fallbacks: [] },
        unavailableRefs: [],
        editable: true,
        owner: "agents",
      },
      {
        kind: "global-default",
        key: "text",
        label: "Text default",
        configPath: "agents.defaults.model",
        source: "default",
        supportedShape: "agentModelConfig",
        selection: { primary: "cpa/gpt-5.4", fallbacks: ["cpa/gpt-5.4-mini"] },
        effective: { primary: "cpa/gpt-5.4", fallbacks: ["cpa/gpt-5.4-mini"] },
        unavailableRefs: [],
        editable: true,
        owner: "agents",
      },
      {
        kind: "global-default",
        key: "compaction",
        label: "Compaction default",
        configPath: "agents.defaults.compaction.model",
        source: "default",
        supportedShape: "string",
        selection: { primary: "cpa/gpt-5.4" },
        effective: { primary: "cpa/gpt-5.4" },
        unavailableRefs: [],
        editable: true,
        owner: "agents",
      },
    ],
    unsupported: [],
  };
}

function renderPanel() {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(
          NextIntlClientProvider,
          { locale: "en", messages },
          createElement(AgentsPanel),
        ),
      ),
    );
  });
}

function unmountPanel() {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
}

describe("AgentsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
    window.history.replaceState(null, "", "/?panel=agents");
    useAgentsStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.fetchAgentsList.mockResolvedValue({
      agents: defaultAgents,
      defaultId: "main",
      mainKey: "main",
    });
    api.fetchRuntimeConfiguredModels.mockResolvedValue({
      runtimeId: "rt_local",
      payload: {
        models: [
          { id: "gpt-5.4", name: "gpt-5.4", provider: "cpa" },
          { id: "gpt-5.4-mini", name: "gpt-5.4 Mini", provider: "cpa" },
        ],
      },
    });
    api.fetchAgentDetail.mockImplementation(async (agentId: string) => ({
      id: agentId,
      name: agentId === "main" ? "Main" : "Ops",
      workspace: "/workspace",
      model: agentId === "main" ? "gpt-5.4" : "gpt-5.4-mini",
      isDefault: agentId === "main",
      isConfiguredDefault: agentId === "main",
      isMainProtected: agentId === "main",
      mainKey: "main",
      bindingCount: 1,
      sessionCount: 2,
      activeSubagentCount: 0,
      skillMode: "all",
      effectiveSkills: [],
      totalAvailableSkills: 0,
      subagents: {
        allowAgents: [],
        effectiveMaxSpawnDepth: 1,
        effectiveMaxChildrenPerAgent: 1,
      },
      identityExists: true,
    }));
    api.fetchAgentModelPolicy.mockImplementation(async (agentId?: string) =>
      modelPolicyFixture(agentId ?? "main"),
    );
    api.updateAgentModelPolicy.mockResolvedValue({
      ok: true,
      agentId: "ops",
      configHash: "ops-policy-hash-2",
    });
    api.fetchAgentSkills.mockResolvedValue({
      agentId: "main",
      mode: "whitelist",
      skills: ["read"],
      available: [
        { key: "read", name: "Read", eligible: true, assigned: true },
        { key: "write", name: "Write", eligible: true, assigned: false },
        { key: "legacy-browser", name: "Legacy Browser", eligible: false, assigned: false },
      ],
      configHash: "skills-hash",
    });
    api.fetchAgentSubagentConfig.mockResolvedValue({
      agentId: "ops",
      allowAgents: ["*"],
      allowAny: true,
      allAgents: [
        { id: "main", name: "Main" },
        { id: "ops", name: "Ops" },
        { id: "reviewer", name: "Reviewer" },
      ],
      configHash: "subagents-hash",
      effectiveMaxChildrenPerAgent: 5,
      effectiveMaxSpawnDepth: 1,
    });
    api.updateAgentSubagentConfig.mockResolvedValue({
      ok: true,
      agentId: "ops",
      allowAgents: ["main", "ops", "reviewer"],
      configHash: "subagents-hash-2",
    });
    api.fetchAgentEventStreams.mockResolvedValue({
      agentId: "main",
      eventStreams: ["lifecycle", "assistant"],
      configHash: "streams-hash",
    });
    api.streamEvents.mockImplementation(
      ({ onStatusChange }: { onStatusChange?: (status: string) => void }) => {
        onStatusChange?.("connected");
        return new Promise(() => {});
      },
    );
    api.normalizeAgentSubagentPermissionOptions.mockImplementation(
      (response: {
        allowAgents: string[];
        allowAny?: boolean;
        allAgents?: Array<{ id: string; name?: string }>;
      }) =>
        (response.allAgents ?? response.allowAgents.map((id) => ({ id }))).map((row) => ({
          ...row,
          allowed:
            response.allowAny === true ||
            response.allowAgents.includes("*") ||
            response.allowAgents.includes(row.id),
        })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    unmountPanel();
    window.history.replaceState(null, "", "/");
    container.remove();
  });

  it("renders ready list state and passes a11y", async () => {
    renderPanel();

    expect(await screen.findByText("Main")).toBeTruthy();
    expect(screen.getByText("Ops")).toBeTruthy();
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });

  it("renders empty and error list states", async () => {
    api.fetchAgentsList.mockResolvedValueOnce({ agents: [], defaultId: undefined });
    renderPanel();
    expect(await screen.findByText("No agents yet")).toBeTruthy();
    unmountPanel();

    useAgentsStore.getState().reset();
    api.fetchAgentsList.mockRejectedValueOnce(new Error("runtime unavailable"));
    renderPanel();
    expect(await screen.findByText("Could not load agents")).toBeTruthy();
    expect(screen.getByText("runtime unavailable")).toBeTruthy();
  });

  it("saves overview edits through typed API wrappers", async () => {
    api.updateAgent.mockResolvedValue({ ok: true, id: "main" });
    renderPanel();

    const mainRow = (await screen.findByText("Main")).closest("button");
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Main Ops" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateAgent).toHaveBeenCalledWith("main", { name: "Main Ops" });
    });
  });

  it("does not submit protected main delete from the UI", async () => {
    renderPanel();

    const mainRow = (await screen.findByText("Main")).closest("button");
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);

    expect(await screen.findByText(/protected system\/fallback agent/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete agent" })).toBeNull();
    fireEvent.click(await screen.findByRole("tab", { name: /Danger zone/ }));
    expect(screen.queryByRole("button", { name: "Delete agent" })).toBeNull();
    expect(api.deleteAgent).not.toHaveBeenCalled();
  });

  it("surfaces section save conflicts without discarding local edits", async () => {
    api.updateAgentSkills.mockRejectedValue(new Error("409 conflict: stale hash"));
    renderPanel();

    const mainRow = (await screen.findByText("Main")).closest("button");
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Skills/ }));
    fireEvent.click(await screen.findByRole("switch", { name: "Toggle skill Write" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateAgentSkills).toHaveBeenCalledWith("main", {
        mode: "whitelist",
        skills: ["read", "write"],
        baseHash: "skills-hash",
      });
    });
    expect(await screen.findByText("Someone else updated this")).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Toggle skill Write" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("saves guarded runtime edits separately from identity edits", async () => {
    api.updateAgent.mockResolvedValue({ ok: true, id: "ops" });
    renderPanel();

    const opsRow = (await screen.findByText("Ops")).closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Runtime/ }));

    fireEvent.change(await screen.findByLabelText("Workspace"), { target: { value: "/ops-v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and save" }));

    await waitFor(() => {
      expect(api.updateAgent).toHaveBeenCalledWith("ops", {
        workspace: "/ops-v2",
      });
    });
  });

  it("saves per-agent model policy through the model-policy mutation", async () => {
    renderPanel();

    const opsRow = (await screen.findByText("Ops")).closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Runtime/ }));

    expect(await screen.findByText("Model usage policy")).toBeTruthy();
    const primaryInputs = await screen.findAllByLabelText("Select primary model");
    fireEvent.change(primaryInputs[0], { target: { value: "cpa/gpt-5.4" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save policy" });
    await waitFor(() => {
      expect(saveButtons[0].hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(api.updateAgentModelPolicy).toHaveBeenCalledWith({
        target: { kind: "agent-model", key: "agent", agentId: "ops" },
        baseHash: "ops-policy-hash",
        selection: { primary: "cpa/gpt-5.4", fallbacks: [] },
      });
    });
    expect(window.confirm).toHaveBeenCalledWith(
      "This changes runtime cost, capability, fallback, or availability behavior. Continue?",
    );
  });

  it("keeps ineligible skills disabled and out of whitelist saves", async () => {
    api.updateAgentSkills.mockResolvedValue({
      ok: true,
      mode: "whitelist",
      skills: ["read", "write"],
      configHash: "skills-hash-2",
    });
    renderPanel();

    const opsRow = (await screen.findByText("Ops")).closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Skills/ }));

    const disabledSkill = await screen.findByRole("switch", {
      name: "Toggle skill Legacy Browser",
    });
    expect(disabledSkill.hasAttribute("disabled")).toBe(true);
    fireEvent.click(disabledSkill);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle skill Write" }));
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => {
      expect(saveButton.hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateAgentSkills).toHaveBeenCalledWith("ops", {
        mode: "whitelist",
        skills: ["read", "write"],
        baseHash: "skills-hash",
      });
    });
  });

  it("represents wildcard subagent permissions as allow-any and guards narrowing", async () => {
    renderPanel();

    const opsRow = (await screen.findByText("Ops")).closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Subagents/ }));

    expect(await screen.findByText(/Gateway wildcard is active/i)).toBeTruthy();
    const mainToggle = screen.getByRole("switch", { name: "Permit subagent Main" });
    expect(mainToggle.getAttribute("aria-checked")).toBe("true");
    expect(mainToggle.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "Explicit list" }));
    expect(await screen.findByText(/narrows the previous wildcard/i)).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => {
      expect(saveButton.hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateAgentSubagentConfig).toHaveBeenCalledWith("ops", {
        allowAgents: ["main", "ops", "reviewer"],
        baseHash: "subagents-hash",
      });
    });
  });

  it("preserves real Gateway event stream names alongside declared UI options", async () => {
    api.updateAgentEventStreams.mockResolvedValue({
      ok: true,
      eventStreams: ["lifecycle", "assistant", "session.message"],
      configHash: "streams-hash-2",
    });
    renderPanel();

    const mainRow = (await screen.findByText("Main")).closest("button");
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Event streams/i }));

    expect(await screen.findByText("lifecycle")).toBeTruthy();
    expect(screen.getByText("assistant")).toBeTruthy();
    expect(screen.getByText("session.message")).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Toggle stream lifecycle" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("switch", { name: "Toggle stream assistant" }).getAttribute("aria-checked"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle stream session.message" }));
    const streamSection = screen
      .getByText("Configure declared event streams without inventing new payload types.")
      .closest(".agent-section");
    expect(streamSection).toBeTruthy();
    const saveButton = within(streamSection as HTMLElement).getByRole("button", {
      name: "Save changes",
    });
    await waitFor(() => {
      expect(saveButton.hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateAgentEventStreams).toHaveBeenCalledWith(
        "main",
        ["lifecycle", "assistant", "session.message"],
        "streams-hash",
      );
    });
  });

  it("keeps routing impact read-only with an owning-module navigation affordance", async () => {
    renderPanel();

    const opsRow = (await screen.findByText("Ops")).closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("tab", { name: /Routing impact/ }));

    expect(await screen.findByText(/Read-only impact summary/i)).toBeTruthy();
    expect(screen.getByText(/Routing owns rule editing/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Routing" })).toBeTruthy();
  });

  it("creates and deletes agents through backend-supported fields", async () => {
    api.createAgent.mockResolvedValue({ ok: true, id: "research" });
    api.deleteAgent.mockResolvedValue({ ok: true, id: "research" });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "New agent" }));
    expect(await screen.findByText("Create agent")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Research" } });
    fireEvent.change(screen.getByLabelText("Emoji"), { target: { value: "R" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Workspace"), {
      target: { value: "/workspace" },
    });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "gpt-5.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create agent" }));

    await waitFor(() => {
      expect(api.createAgent).toHaveBeenCalledWith({
        name: "Research",
        workspace: "/workspace",
        model: "gpt-5.4",
        emoji: "R",
      });
    });

    const opsRow = screen.getByText("Ops").closest("button");
    expect(opsRow).toBeTruthy();
    fireEvent.click(opsRow!);
    fireEvent.click(await screen.findByRole("button", { name: "Delete agent" }));
    const deleteDialog = await screen.findByRole("dialog", { name: "Delete agent" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteAgent).toHaveBeenCalledWith("ops");
    });
  });
});
