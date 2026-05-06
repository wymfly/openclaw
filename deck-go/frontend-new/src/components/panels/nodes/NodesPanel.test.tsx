// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { NodesPanel } from "./NodesPanel";

const apiMocks = vi.hoisted(() => ({
  approveNodePairing: vi.fn(),
  describeNode: vi.fn(),
  enqueueNodePendingWork: vi.fn(),
  fetchNodePairing: vi.fn(),
  fetchNodes: vi.fn(),
  invokeNodeCommand: vi.fn(),
  rejectNodePairing: vi.fn(),
  renameNode: vi.fn(),
  requestNodePairing: vi.fn(),
  verifyNodePairing: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(NodesPanel)));
  });
}

function nodesPayload() {
  return {
    nodes: [
      {
        nodeId: "node-a",
        displayName: "Alpha Node",
        platform: "darwin",
        version: "1.0.0",
        coreVersion: "1.0.1",
        uiVersion: "1.0.2",
        deviceFamily: "mac",
        modelIdentifier: "MacBookPro",
        remoteIp: "127.0.0.1",
        caps: ["chat"],
        commands: ["send"],
        pathEnv: "/usr/local/bin:/usr/bin",
        connectedAtMs: 1_774_510_000_000,
        paired: true,
        connected: true,
      },
      {
        nodeId: "node-b",
        displayName: "Beta Node",
        platform: "linux",
        version: "2.0.0",
        remoteIp: "10.0.0.2",
        caps: [],
        commands: [],
        paired: false,
        connected: false,
      },
    ],
  };
}

function pairingPayload() {
  return {
    pending: [
      {
        requestId: "pair-b",
        nodeId: "node-b",
        displayName: "Beta Node",
        platform: "linux",
        isRepair: true,
        ts: 1,
      },
    ],
  };
}

function orphanPairingPayload() {
  return {
    pending: [
      {
        requestId: "pair-orphan",
        nodeId: "node-orphan",
        displayName: "Unlisted Node",
        platform: "android",
        isRepair: false,
        ts: 2,
      },
    ],
  };
}

function detailFor(nodeId: string) {
  const node = nodesPayload().nodes.find((item) => item.nodeId === nodeId);
  if (!node) {
    throw new Error(`unknown node ${nodeId}`);
  }
  return { ...node, permissions: { camera: false, shell: nodeId === "node-a" } };
}

async function clickButton(text: string, options: { exact?: boolean } = {}) {
  const exact = options.exact ?? true;
  await act(async () => {
    Array.from(container.querySelectorAll("button"))
      .find((button) => {
        const value = button.textContent?.trim() ?? "";
        return exact ? value === text : value.includes(text);
      })
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("NodesPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchNodes.mockResolvedValue(nodesPayload());
    apiMocks.fetchNodePairing.mockResolvedValue(pairingPayload());
    apiMocks.describeNode.mockImplementation((nodeId: string) =>
      Promise.resolve(detailFor(nodeId)),
    );
    apiMocks.enqueueNodePendingWork.mockResolvedValue({
      nodeId: "node-a",
      queued: { id: "pending-1", type: "status.request" },
      revision: 1,
      wakeTriggered: true,
    });
    apiMocks.invokeNodeCommand.mockResolvedValue({
      ok: true,
      nodeId: "node-a",
      command: "send",
      payload: { delivered: true },
    });
    apiMocks.renameNode.mockResolvedValue({ ok: true, action: "rename" });
    apiMocks.approveNodePairing.mockResolvedValue({ ok: true, action: "approve" });
    apiMocks.rejectNodePairing.mockResolvedValue({ ok: true, action: "reject" });
    apiMocks.requestNodePairing.mockResolvedValue({
      status: "pending",
      request: { requestId: "pair-requested", nodeId: "node-c", ts: 1 },
      created: true,
    });
    apiMocks.verifyNodePairing.mockResolvedValue({ ok: true, action: "verify" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads node inventory, pairing requests, and defaults to the first pending request", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchNodes).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));

    expect(apiMocks.fetchNodePairing).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("2 nodes");
    expect(container.textContent).toContain("1 pending");
    expect(container.textContent).toContain("Alpha Node");
    expect(container.textContent).toContain("Beta Node");
    expect(container.textContent).toContain("request: pair-b");
    expect(container.textContent).toContain("Repair: yes");
    expect(container.textContent).toContain("platform: darwin | connected: yes");
    expect(container.textContent).toContain("paired: no");
    expect(container.textContent).toContain("Repair requested");
    expect(container.textContent).toContain(
      "Review the repair request and approve it if the device is trusted.",
    );

    await clickButton("Alpha Node", { exact: false });

    expect(container.textContent).toContain("Connected and ready");
    expect(container.textContent).toContain(
      "This node is paired and currently connected, so remote capabilities should be available.",
    );
    await waitFor(() => expect(container.textContent).toContain("Core Version"));
    expect(container.textContent).toContain("1.0.1");
    expect(container.textContent).toContain("UI Version");
    expect(container.textContent).toContain("1.0.2");
    expect(container.textContent).toContain("Device Family");
    expect(container.textContent).toContain("MacBookPro");
    expect(container.textContent).toContain("/usr/local/bin:/usr/bin");
    expect(container.textContent).toContain("Capabilities");
    expect(container.textContent).toContain("chat");
    expect(container.textContent).toContain("Commands");
    expect(container.textContent).toContain("send");
    expect(container.textContent).toContain("Invoke node command");
    expect(container.textContent).toContain("Pending work");
    expect(container.textContent).toContain("Permissions");
    expect(container.textContent).toContain("shell: allowed");
    expect(container.textContent).toContain("camera: denied");
    expect(container.querySelector(".nodes-panel")).toBeTruthy();
    expect(container.querySelectorAll(".nodes-panel__card")).toHaveLength(2);
    expect(container.querySelectorAll(".nodes-panel__body")).toHaveLength(2);
    expect(container.querySelector(".nodes-panel__pill-row")).toBeTruthy();
    expect(container.querySelector(".nodes-panel__metrics")).toBeTruthy();
    expect(container.querySelector(".nodes-panel__detail-metrics")).toBeTruthy();
    expect(container.querySelectorAll(".nodes-panel__surface").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll(".nodes-panel__list")).toHaveLength(2);
    expect(container.querySelectorAll(".nodes-panel__row").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".nodes-panel__actions").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".nodes-panel__button").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll(".nodes-panel__input").length).toBeGreaterThanOrEqual(5);
    expect(container.querySelector(".nodes-panel__textarea")).toBeTruthy();
    expect(container.querySelector(".nodes-panel__check")).toBeTruthy();
    expect(container.querySelector(".nodes-panel__surface-grid")).toBeTruthy();
    expect(container.querySelector(".nodes-panel__hero")).toBeTruthy();

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Alpha Node");
  });

  it("runs rename and pairing actions while preserving the preferred node", async () => {
    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));

    await clickButton("request: pair-b", { exact: false });

    await waitFor(() => expect(container.querySelector("input")?.value).toBe("Beta Node"));
    expect(container.textContent).toContain("Repair requested");
    expect(container.textContent).toContain(
      "Review the repair request and approve it if the device is trusted.",
    );

    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: " Beta Renamed " } });
    });

    await clickButton("Rename");
    expect(container.textContent).toContain("Rename node?");
    await clickButton("Confirm");

    await waitFor(() => expect(apiMocks.renameNode).toHaveBeenCalledWith("node-b", "Beta Renamed"));
    expect(container.textContent).toContain("Last node action");

    const selectedAfterRename = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterRename?.textContent).toContain("Beta Node");

    await clickButton("Approve pairing");
    expect(container.textContent).toContain("Approve pairing?");
    await clickButton("Confirm");

    await waitFor(() => expect(apiMocks.approveNodePairing).toHaveBeenCalledWith("pair-b"));

    await clickButton("Reject pairing");
    expect(container.textContent).toContain("Reject pairing?");
    await clickButton("Confirm");

    await waitFor(() => expect(apiMocks.rejectNodePairing).toHaveBeenCalledWith("pair-b"));

    const verificationInput = container.querySelector(
      'input[aria-label="Pairing verification token"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(verificationInput, { target: { value: " token-1 " } });
    });

    await clickButton("Verify pairing");
    expect(container.textContent).toContain("Verify token?");
    await clickButton("Confirm");

    await waitFor(() =>
      expect(apiMocks.verifyNodePairing).toHaveBeenCalledWith("node-b", "token-1"),
    );
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("does not approve or reject pairing when inline confirmation is cancelled", async () => {
    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));

    await clickButton("request: pair-b", { exact: false });

    await waitFor(() => expect(container.textContent).toContain("Repair requested"));

    await clickButton("Approve pairing");
    expect(container.textContent).toContain("Approve pairing?");
    await clickButton("Cancel");

    expect(apiMocks.approveNodePairing).not.toHaveBeenCalled();

    await clickButton("Reject pairing");
    expect(container.textContent).toContain("Reject pairing?");
    await clickButton("Cancel");

    expect(apiMocks.rejectNodePairing).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("approves pairing requests that are not present in node inventory", async () => {
    apiMocks.fetchNodes.mockResolvedValue({
      nodes: [nodesPayload().nodes[0]],
    });
    apiMocks.fetchNodePairing.mockResolvedValue(orphanPairingPayload());

    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));
    expect(container.textContent).toContain("Unlisted Node");

    await clickButton("pair-orphan", { exact: false });

    expect(container.textContent).toContain("Pairing request");
    expect(container.textContent).toContain(
      "This pairing request is not present in node inventory yet",
    );

    await clickButton("Approve pairing");
    expect(container.textContent).toContain("Approve pairing?");
    await clickButton("Confirm");

    await waitFor(() => expect(apiMocks.approveNodePairing).toHaveBeenCalledWith("pair-orphan"));
    expect(apiMocks.describeNode).not.toHaveBeenCalledWith("node-orphan");
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("invokes advertised node commands and queues pending work through the Gateway facade", async () => {
    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));
    await clickButton("Alpha Node", { exact: false });
    await waitFor(() => expect(container.textContent).toContain("Connected and ready"));

    const commandSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Node command"]',
    );
    const timeoutInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Node invoke timeout"]',
    );
    const paramsTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Node invoke params JSON"]',
    );
    expect(commandSelect?.value).toBe("send");
    expect(timeoutInput).toBeTruthy();
    expect(paramsTextarea).toBeTruthy();

    await act(async () => {
      fireEvent.change(timeoutInput as HTMLInputElement, { target: { value: "6000" } });
      fireEvent.change(paramsTextarea as HTMLTextAreaElement, {
        target: { value: '{"message":"hello"}' },
      });
    });

    await clickButton("Invoke command");
    expect(container.textContent).toContain("Invoke command?");
    await clickButton("Confirm");

    await waitFor(() =>
      expect(apiMocks.invokeNodeCommand).toHaveBeenCalledWith(
        "node-a",
        "send",
        { message: "hello" },
        6000,
      ),
    );
    expect(container.textContent).toContain("Last node action");
    expect(container.textContent).toContain('"delivered": true');

    const pendingType = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Pending work type"]',
    );
    const pendingPriority = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Pending work priority"]',
    );
    const pendingWake = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.parentElement?.textContent?.includes("wake if offline"),
    );
    expect(pendingType).toBeTruthy();
    expect(pendingPriority).toBeTruthy();
    expect(pendingWake).toBeTruthy();

    await act(async () => {
      fireEvent.change(pendingType as HTMLSelectElement, {
        target: { value: "location.request" },
      });
      fireEvent.change(pendingPriority as HTMLSelectElement, { target: { value: "high" } });
      fireEvent.click(pendingWake as HTMLInputElement);
    });

    await clickButton("Queue pending work");
    expect(container.textContent).toContain("Queue pending work?");
    await clickButton("Confirm");

    await waitFor(() =>
      expect(apiMocks.enqueueNodePendingWork).toHaveBeenCalledWith({
        nodeId: "node-a",
        priority: "high",
        type: "location.request",
        wake: false,
      }),
    );
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("blocks node command invocation when params JSON is invalid", async () => {
    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Nodes ready"));
    await clickButton("Alpha Node", { exact: false });
    await waitFor(() => expect(container.textContent).toContain("Connected and ready"));

    const paramsTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Node invoke params JSON"]',
    );
    expect(paramsTextarea).toBeTruthy();

    await act(async () => {
      fireEvent.change(paramsTextarea as HTMLTextAreaElement, {
        target: { value: '{"message":' },
      });
    });

    await clickButton("Invoke command");

    expect(apiMocks.invokeNodeCommand).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Invalid invoke params JSON");
    expect(container.textContent).not.toContain("Invoke command?");
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("requests pairing for an unpaired node when no request is already pending", async () => {
    const unpairedNode = {
      nodeId: "node-c",
      displayName: "Gamma Node",
      platform: "linux",
      version: "3.0.0",
      remoteIp: "10.0.0.3",
      caps: ["status"],
      commands: ["status"],
      paired: false,
      connected: false,
    };
    apiMocks.fetchNodes.mockResolvedValue({ nodes: [unpairedNode] });
    apiMocks.fetchNodePairing.mockResolvedValue({ pending: [] });
    apiMocks.describeNode.mockResolvedValue(unpairedNode);

    renderPanel();

    await waitFor(() => expect(container.textContent).toContain("Gamma Node"));
    expect(container.textContent).toContain("Unpaired");
    expect(container.textContent).toContain("Request pairing");

    await clickButton("Request pairing");
    expect(container.textContent).toContain("Request pairing?");
    await clickButton("Confirm");

    await waitFor(() =>
      expect(apiMocks.requestNodePairing).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: "node-c",
          displayName: "Gamma Node",
          platform: "linux",
          version: "3.0.0",
          remoteIp: "10.0.0.3",
          caps: ["status"],
          commands: ["status"],
        }),
      ),
    );
    expect(container.textContent).toContain("Last node action");
    expect(container.textContent).toContain("pair-requested");
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("renders the migrated nodes shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() => expect(apiMocks.fetchNodes).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("节点就绪"));

    expect(container.textContent).toContain("2 个节点");
    expect(container.textContent).toContain("1 个待处理");
    expect(container.textContent).toContain("节点列表");
    expect(container.textContent).toContain("当前节点");
    expect(container.textContent).toContain("待处理配对");
  });
});
