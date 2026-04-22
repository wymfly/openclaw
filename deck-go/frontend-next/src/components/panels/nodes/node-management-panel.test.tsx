// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const table: Record<string, Record<string, string>> = {
      nodes: {
        emptyTitle: "No Nodes",
        emptyDescription: "No remote nodes connected or paired",
        pendingRequests: "Pending Requests",
        nodesList: "Nodes",
        selectNode: "Select a node to view details",
        nodeId: "Node ID",
        version: "Version",
        coreVersion: "Core Version",
        uiVersion: "UI Version",
        deviceFamily: "Device Family",
        model: "Model",
        remoteIp: "Remote IP",
        connectedAt: "Connected At",
        capabilities: "Capabilities",
        commands: "Commands",
        statusConnected: "Connected",
        statusPaired: "Paired",
        statusUnpaired: "Unpaired",
        repair: "Repair",
        approve: "Approve",
        reject: "Reject",
        diagnosticsTitle: "Node Diagnostics",
        diagnosticsDescription: "Understand node and pairing lifecycle state.",
        lifecycleTitle: "Lifecycle",
        lifecyclePendingTitle: "Pending pairing request",
        lifecyclePendingDescription:
          "This node is waiting for approval before it can become a paired device.",
        lifecyclePendingNextStep: "Approve or reject the pending request to continue onboarding.",
        lifecycleRepairTitle: "Repair requested",
        lifecycleRepairDescription:
          "This node was previously paired and is requesting a repair approval to recover access.",
        lifecycleRepairNextStep:
          "Review the repair request and approve it if the device is trusted.",
        lifecycleOfflineTitle: "Paired but offline",
        lifecycleOfflineDescription:
          "This node is paired, but it is not currently connected to the gateway.",
        lifecycleOfflineNextStep:
          "Bring the node back online or re-run repair if connectivity cannot recover.",
        lifecycleConnectedTitle: "Connected and ready",
        lifecycleConnectedDescription:
          "This node is paired and currently connected, so remote capabilities should be available.",
        lifecycleConnectedNextStep:
          "Use the capability and command sections below to inspect what this node can do.",
        lifecycleUnpairedTitle: "Unpaired",
        lifecycleUnpairedDescription:
          "This node has not finished pairing, so remote access is not yet available.",
        lifecycleUnpairedNextStep:
          "Start or approve a pairing flow before expecting remote node features to work.",
        pairingRequestTitle: "Pairing request",
        pairingRequestDescription:
          "Pending requests and repair requests are shown here so you can connect lifecycle state to required action.",
        requestKindPending: "Pending",
        requestKindRepair: "Repair",
        lifecycleCurrentRequest: "Current request",
        lifecycleRequestedAt: "Requested At",
        lifecycleNextStepLabel: "Next step",
        loadingDetail: "Loading node details…",
      },
      common: { loading: "Loading" },
    };
    const value = table[ns]?.[key] ?? key;
    if (!values) {return value;}
    return value.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
  },
}));

vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: () => ({ addToast: vi.fn() }),
}));

let NodeManagementPanel: typeof import("./NodeManagementPanel").default;
let useNodesStore: typeof import("@/stores/nodes").useNodesStore;

beforeEach(async () => {
  vi.resetModules();
  ({ default: NodeManagementPanel } = await import("./NodeManagementPanel"));
  ({ useNodesStore } = await import("@/stores/nodes"));

  const now = Date.now();
  useNodesStore.setState({
    nodes: [
      {
        nodeId: "node-1",
        displayName: "Primary Node",
        platform: "ios",
        version: "1.0.0",
        coreVersion: "1.0.0",
        uiVersion: "1.0.0",
        deviceFamily: "phone",
        modelIdentifier: "iphone",
        remoteIp: undefined,
        caps: ["camera"],
        commands: ["screen"],
        paired: false,
        connected: false,
      },
      {
        nodeId: "node-2",
        displayName: "Backup Node",
        platform: "android",
        version: "1.0.0",
        coreVersion: "1.0.0",
        uiVersion: "1.0.0",
        deviceFamily: "tablet",
        modelIdentifier: "pixel",
        remoteIp: undefined,
        caps: [],
        commands: [],
        paired: true,
        connected: true,
      },
    ],
    nodeDetails: {
      "node-1": {
        nodeId: "node-1",
        displayName: "Primary Node",
        platform: "ios",
        version: "1.0.0",
        coreVersion: "1.0.0",
        uiVersion: "1.0.0",
        deviceFamily: "phone",
        modelIdentifier: "iphone",
        remoteIp: "10.0.0.2",
        caps: ["camera"],
        commands: ["screen"],
        paired: false,
        connected: false,
      },
    },
    pairingRequests: [
      {
        requestId: "req-1",
        nodeId: "node-1",
        displayName: "Primary Node",
        platform: "ios",
        isRepair: true,
        ts: now,
      },
    ],
    selectedNodeId: "node-1",
    describingNodeId: null,
    loading: false,
    error: null,
    fetchNodes: vi.fn(async () => {}),
    fetchPairing: vi.fn(async () => {}),
    selectNode: vi.fn((id: string | null) => useNodesStore.setState({ selectedNodeId: id })),
    describeNode: vi.fn(async (nodeId: string) => {
      if (nodeId === "node-2") {
        const detail = {
          nodeId: "node-2",
          displayName: "Backup Node",
          platform: "android",
          version: "2.0.0",
          coreVersion: "2.0.0",
          uiVersion: "2.0.0",
          deviceFamily: "tablet",
          modelIdentifier: "pixel",
          remoteIp: "10.0.0.5",
          caps: ["notify"],
          commands: ["camera"],
          paired: true,
          connected: true,
        };
        useNodesStore.setState((state) => ({
          nodeDetails: { ...state.nodeDetails, [nodeId]: detail },
        }));
        return detail;
      }
      return useNodesStore.getState().nodeDetails[nodeId] ?? null;
    }),
    renameNode: vi.fn(async () => true),
    approvePairing: vi.fn(async () => true),
    rejectPairing: vi.fn(async () => true),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NodeManagementPanel", () => {
  it("shows lifecycle explanation tied to the selected node and repair request", () => {
    render(createElement(NodeManagementPanel));

    expect(screen.getByText("Node Diagnostics")).toBeTruthy();
    expect(screen.getByText("Repair requested")).toBeTruthy();
    expect(
      screen.getByText(
        "This node was previously paired and is requesting a repair approval to recover access.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Current request")).toBeTruthy();
  });

  it("requests node.describe when selecting another node and renders the detailed result", async () => {
    render(createElement(NodeManagementPanel));

    fireEvent.click(screen.getByRole("button", { name: /Backup Node/ }));

    await waitFor(() =>
      expect(useNodesStore.getState().describeNode).toHaveBeenCalledWith("node-2"),
    );
    expect(screen.getByText("Connected and ready")).toBeTruthy();
    expect(screen.getByText("10.0.0.5")).toBeTruthy();
  });
});
