// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const table: Record<string, Record<string, string>> = {
      agents: {
        create: "New Agent",
        namePlaceholder: "Enter name...",
        batchExport: "Copy Agent List",
        batchSummary: `${values?.total ?? 0} selected · idle ${values?.idle ?? 0} · busy ${values?.busy ?? 0}`,
        batchCopied: "Agent list copied",
      },
      common: {
        create: "Create",
        cancel: "Cancel",
        loading: "Loading",
      },
      lists: {
        selected: `${values?.count ?? 0} selected`,
        selectAll: "Select all",
        clearSelection: "Clear selection",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

const addToast = vi.fn();
vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: (selector?: (state: { addToast: typeof addToast }) => unknown) =>
    selector ? selector({ addToast }) : { addToast },
}));

let AgentList: typeof import("./AgentList").AgentList;
let useAgentsStore: typeof import("@/stores/agents").useAgentsStore;

beforeEach(async () => {
  vi.resetModules();
  ({ AgentList } = await import("./AgentList"));
  ({ useAgentsStore } = await import("@/stores/agents"));
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });

  useAgentsStore.setState({
    agents: [
      { id: "main", name: "Main", model: "gpt-5.4", status: "idle" },
      { id: "ops", name: "Ops", model: "gpt-5.4-mini", status: "busy" },
    ],
    selectedAgentId: null,
    defaultAgentId: "main",
    pendingTab: null,
    compareAgentId: null,
    loading: false,
    selectedIds: new Set(),
    setAgents: vi.fn(),
    selectAgent: vi.fn((id: string | null) => useAgentsStore.setState({ selectedAgentId: id })),
    setPendingTab: vi.fn(),
    setCompareAgentId: vi.fn(),
    updateAgent: vi.fn(),
    setLoading: vi.fn(),
    fetchAgents: vi.fn(async () => {}),
    createAgent: vi.fn(async () => {}),
    deleteAgent: vi.fn(async () => {}),
    toggleSelected: vi.fn((id: string) =>
      useAgentsStore.setState((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {next.delete(id);}
        else {next.add(id);}
        return { selectedIds: next };
      }),
    ),
    clearSelection: vi.fn(() => useAgentsStore.setState({ selectedIds: new Set() })),
    selectAll: vi.fn(() =>
      useAgentsStore.setState({
        selectedIds: new Set(useAgentsStore.getState().agents.map((agent) => agent.id)),
      }),
    ),
  } as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AgentList batch actions", () => {
  it("shows batch bar and copies a human-readable export after multi-select", async () => {
    render(<AgentList />);

    fireEvent.click(screen.getByLabelText("Select agent Main"));
    fireEvent.click(screen.getByLabelText("Select agent Ops"));

    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.getByText("2 selected · idle 1 · busy 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy Agent List" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      [
        "name | id | model | status",
        "Main | main | gpt-5.4 | idle",
        "Ops | ops | gpt-5.4-mini | busy",
      ].join("\n"),
    );
    await waitFor(() => expect(addToast).toHaveBeenCalled());
  });

  it("keeps row click for detail selection while checkbox drives batch selection", () => {
    render(<AgentList />);

    fireEvent.click(screen.getByText("Main"));
    expect(useAgentsStore.getState().selectedAgentId).toBe("main");

    fireEvent.click(screen.getByLabelText("Select agent Main"));
    expect(useAgentsStore.getState().selectedIds.has("main")).toBe(true);
    expect(useAgentsStore.getState().selectedAgentId).toBe("main");
  });
});
