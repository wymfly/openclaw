// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ApprovalsPanel } from "./ApprovalsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchApprovalsPolicy: vi.fn(),
  fetchPendingApprovals: vi.fn(),
  fetchPluginApprovals: vi.fn(),
  resolveApproval: vi.fn(),
  resolvePluginApproval: vi.fn(),
  streamEvents: vi.fn(),
  updateApprovalsPolicy: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

type CapturedApprovalStreamParams = {
  signal: AbortSignal;
  onEvent(event: { event?: string; data?: string; json?: unknown }): void;
};

let container: HTMLDivElement;
let root: Root | null = null;
let streamParams: CapturedApprovalStreamParams | null = null;

const baseTime = Date.now();

function renderApprovalsPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(ApprovalsPanel)));
}

function policyPayload() {
  return {
    hash: "policy-hash",
    file: {
      defaults: { security: "allowlist", ask: "on-miss" },
      agents: {
        main: { security: "full", ask: "always" },
      },
      allowlist: ["pwd", "ls"],
    },
  };
}

function pendingPayload() {
  return {
    pending: [
      {
        id: "approval-main",
        command: "pnpm test",
        agentId: "main",
        sessionKey: "sess-main",
        runId: "run-main",
        cwd: "/repo",
        createdAtMs: baseTime - 1_000,
        expiresAtMs: baseTime + 60_000,
      },
      {
        id: "approval-build",
        command: "pnpm build",
        agentId: "builder",
        sessionKey: "sess-build",
        runId: "run-build",
        cwd: "/repo",
        createdAtMs: baseTime - 2_000,
        expiresAtMs: baseTime + 120_000,
      },
      {
        id: "approval-expired",
        command: "rm stale",
        agentId: "main",
        sessionKey: "sess-old",
        runId: "run-old",
        cwd: "/repo",
        createdAtMs: baseTime - 20_000,
        expiresAtMs: baseTime - 1_000,
      },
    ],
  };
}

function pluginPayload() {
  return {
    entries: [
      {
        id: "plugin-ap-main",
        pluginId: "wecom",
        command: "connect workspace",
        description: "Allow the plugin to connect a workspace.",
        createdAtMs: baseTime - 3_000,
        expiresAtMs: baseTime + 90_000,
        status: "pending",
      },
      {
        id: "plugin-ap-resolved",
        pluginId: "discord",
        command: "sync channel",
        description: "Already resolved.",
        createdAtMs: baseTime - 30_000,
        expiresAtMs: baseTime + 90_000,
        status: "resolved",
        decision: "allow-once",
      },
    ],
  };
}

describe("ApprovalsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchApprovalsPolicy.mockResolvedValue(policyPayload());
    apiMocks.fetchPendingApprovals.mockResolvedValue(pendingPayload());
    apiMocks.fetchPluginApprovals.mockResolvedValue(pluginPayload());
    apiMocks.resolveApproval.mockResolvedValue({ ok: true, id: "approval-build" });
    apiMocks.resolvePluginApproval.mockResolvedValue({ ok: true, id: "plugin-ap-main" });
    streamParams = null;
    apiMocks.streamEvents.mockImplementation(async (params: CapturedApprovalStreamParams) => {
      streamParams = params;
    });
    apiMocks.updateApprovalsPolicy.mockResolvedValue({ ok: true, hash: "policy-hash-2" });
    deckUIMocks.navigateToAgent.mockClear();
    deckUIMocks.navigateToSession.mockClear();
    deckUIMocks.ui.setActivePanel.mockClear();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
  });

  it("loads policy and active pending approvals while filtering expired requests", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchPendingApprovals).toHaveBeenCalledTimes(1));

    expect(apiMocks.fetchApprovalsPolicy).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPluginApprovals).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Approvals ready");
    expect(container.textContent).toContain("2 pending");
    expect(container.textContent).toContain("1 plugin pending");
    expect(container.textContent).toContain("allowlist 2");
    expect(container.textContent).toContain("pnpm test");
    expect(container.textContent).toContain("pnpm build");
    expect(container.textContent).not.toContain("rm stale");
    expect(container.textContent).toContain("Run: run-main");
    expect(container.querySelector(".deck-ui-approvals")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-approvals-card").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-approvals-row").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-approvals-input").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".deck-ui-approvals-button").length).toBeGreaterThanOrEqual(
      12,
    );
    expect(container.querySelectorAll(".deck-ui-approvals-hero").length).toBe(1);
    expect(container.querySelectorAll(".deck-ui-approvals-details").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(container.querySelector(".deck-ui-approvals-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-approvals-textarea")).toBeTruthy();

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("approval-main");
  });

  it("runs approval decisions for the selected request and preserves preferred selection", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchPendingApprovals).toHaveBeenCalledTimes(1));

    const buildButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("approval-build"),
    );
    expect(buildButton).toBeTruthy();

    await act(async () => {
      buildButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Allow always")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.resolveApproval).toHaveBeenCalledWith("approval-build", "allow-always"),
    );
    expect(container.textContent).toContain("Last approval action");
    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("approval-build");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Deny")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.resolveApproval).toHaveBeenLastCalledWith("approval-build", "deny"),
    );
  });

  it("opens the selected approval agent and session through shared deck navigation", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchPendingApprovals).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open approval agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open approval session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, "sess-main");
  });

  it("loads plugin approvals and resolves the selected plugin request", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchPluginApprovals).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Plugin approvals")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("wecom");
    expect(container.textContent).toContain("connect workspace");
    expect(container.textContent).toContain("Plugin approval payload");
    expect(container.textContent).toContain("discord");
    expect(container.textContent).toContain("allow-once");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Allow once")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.resolvePluginApproval).toHaveBeenCalledWith("plugin-ap-main", "allow-once"),
    );
    expect(container.textContent).toContain("Last approval action");
  });

  it("saves edited approval policy through the current policy route", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchApprovalsPolicy).toHaveBeenCalledTimes(1));

    const editor = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="approval policy json"]',
    );
    expect(editor).toBeTruthy();
    const editedPolicy = {
      defaults: { security: "deny", ask: "always" },
      agents: { main: { security: "full", ask: "always" } },
      allowlist: ["pwd"],
    };

    await act(async () => {
      fireEvent.change(editor as HTMLTextAreaElement, {
        target: { value: JSON.stringify(editedPolicy, null, 2) },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save policy")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateApprovalsPolicy).toHaveBeenCalledWith(editedPolicy, "policy-hash"),
    );
    expect(container.textContent).toContain("Last approval action");
  });

  it("edits approval policy defaults, agent overrides, and path allowlist structurally", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchApprovalsPolicy).toHaveBeenCalledTimes(1));

    const globalSecurity = container.querySelector<HTMLSelectElement>(
      'select[aria-label="global security"]',
    );
    const globalAutoAllow = container.querySelector<HTMLInputElement>(
      'input[aria-label="global auto allow skills"]',
    );
    const newAgentInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="new approval agent id"]',
    );
    const newPathInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="new approval allowlist path"]',
    );
    expect(globalSecurity).toBeTruthy();
    expect(globalAutoAllow).toBeTruthy();
    expect(newAgentInput).toBeTruthy();
    expect(newPathInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(globalSecurity as HTMLSelectElement, { target: { value: "deny" } });
      fireEvent.click(globalAutoAllow as HTMLInputElement);
      fireEvent.change(newAgentInput as HTMLInputElement, { target: { value: "builder" } });
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const builderSecurity = container.querySelector<HTMLSelectElement>(
      'select[aria-label="agent builder security"]',
    );
    expect(builderSecurity).toBeTruthy();

    await act(async () => {
      fireEvent.change(builderSecurity as HTMLSelectElement, { target: { value: "full" } });
      fireEvent.change(newPathInput as HTMLInputElement, {
        target: { value: "/tmp/openclaw" },
      });
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Add path")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save policy")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateApprovalsPolicy).toHaveBeenCalledWith(
        {
          defaults: { security: "deny", ask: "on-miss", autoAllowSkills: true },
          agents: {
            main: { security: "full", ask: "always" },
            builder: { security: "full" },
          },
          allowlist: ["pwd", "ls", "/tmp/openclaw"],
        },
        "policy-hash",
      ),
    );
    expect(container.textContent).toContain("Last approval action");
  });

  it("merges live approval stream events and aborts the stream on unmount", async () => {
    await act(async () => {
      renderApprovalsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchPendingApprovals).toHaveBeenCalledTimes(1));

    expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1);
    expect(streamParams).toBeTruthy();

    await act(async () => {
      streamParams?.onEvent({
        event: "approval.pending",
        json: {
          id: "approval-live",
          command: "pnpm lint",
          agentId: "main",
          sessionKey: "sess-live",
          runId: "run-live",
          cwd: "/repo",
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 60_000,
        },
      });
    });

    expect(container.textContent).toContain("3 pending");
    expect(container.textContent).toContain("pnpm lint");

    await act(async () => {
      streamParams?.onEvent({
        event: "approval.resolved",
        data: JSON.stringify({ id: "approval-main" }),
      });
      streamParams?.onEvent({
        event: "approval.pending",
        data: "{not json",
      });
    });

    expect(container.textContent).toContain("2 pending");
    expect(container.textContent).not.toContain("pnpm test");
    expect(container.textContent).toContain("pnpm lint");

    act(() => {
      root?.unmount();
    });
    root = null;
    expect(streamParams?.signal.aborted).toBe(true);
  });
});
