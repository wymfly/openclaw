// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  fetchAgentSkills: vi.fn(),
  fetchAgentSubagentConfig: vi.fn(),
  fetchAgentSystemPromptPreview: vi.fn(),
  fetchAgentToolPolicyPreview: vi.fn(),
  fetchAgentsList: vi.fn(),
  normalizeAgentSubagentPermissionOptions: vi.fn(),
  saveAgentFile: vi.fn(),
  streamEvents: vi.fn(),
  updateAgent: vi.fn(),
  updateAgentEventStreams: vi.fn(),
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
    sessionCount: 2,
    bindingCount: 1,
  },
  {
    id: "ops",
    name: "Ops",
    model: "gpt-5.4-mini",
    status: "busy" as const,
    isDefault: false,
  },
];

function renderPanel() {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(NextIntlClientProvider, { locale: "en", messages }, createElement(AgentsPanel)),
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
    api.fetchAgentsList.mockResolvedValue({ agents: defaultAgents, defaultId: "main" });
    api.fetchAgentDetail.mockResolvedValue({
      id: "main",
      name: "Main",
      workspace: "/workspace",
      isDefault: true,
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
    });
    api.fetchAgentSkills.mockResolvedValue({
      agentId: "main",
      mode: "whitelist",
      skills: ["read"],
      available: [
        { key: "read", name: "Read", eligible: true, assigned: true },
        { key: "write", name: "Write", eligible: true, assigned: false },
      ],
      configHash: "skills-hash",
    });
    api.streamEvents.mockImplementation(
      ({ onStatusChange }: { onStatusChange?: (status: string) => void }) => {
        onStatusChange?.("connected");
        return new Promise(() => {});
      },
    );
    api.normalizeAgentSubagentPermissionOptions.mockImplementation(
      (response: { allowAgents: string[]; allAgents?: Array<{ id: string; name?: string }> }) =>
        (response.allAgents ?? response.allowAgents.map((id) => ({ id }))).map((row) => ({
          ...row,
          allowed: response.allowAgents.includes(row.id),
        })),
    );
  });

  afterEach(() => {
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

    const mainRow = (await screen.findByText("Main")).closest('[role="row"]');
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Main Ops" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateAgent).toHaveBeenCalledWith("main", { name: "Main Ops" });
    });
  });

  it("surfaces section save conflicts without discarding local edits", async () => {
    api.updateAgentSkills.mockRejectedValue(new Error("409 conflict: stale hash"));
    renderPanel();

    const mainRow = (await screen.findByText("Main")).closest('[role="row"]');
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    fireEvent.click(await screen.findByRole("link", { name: /Skills/ }));
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
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "not-submitted" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create agent" }));

    await waitFor(() => {
      expect(api.createAgent).toHaveBeenCalledWith({
        name: "Research",
        workspace: "/workspace",
        emoji: "R",
      });
    });

    const mainRow = screen.getByText("Main").closest('[role="row"]');
    expect(mainRow).toBeTruthy();
    fireEvent.click(mainRow!);
    fireEvent.click(await screen.findByRole("button", { name: "Delete agent" }));
    const deleteDialog = await screen.findByRole("dialog", { name: "Delete agent" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteAgent).toHaveBeenCalledWith("main");
    });
  });
});
