// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SettingsPanel } from "./SettingsPanel";

const apiMocks = vi.hoisted(() => ({
  approveDeviceRequest: vi.fn(),
  fetchDevices: vi.fn(),
  fetchSettings: vi.fn(),
  fetchSelfDevice: vi.fn(),
  fetchSettingsVersion: vi.fn(),
  persistAccessToken: vi.fn(),
  rejectDeviceRequest: vi.fn(),
  removeDevice: vi.fn(),
  revokeDeviceToken: vi.fn(),
  rotateDeviceToken: vi.fn(),
  saveSettings: vi.fn(),
  streamEvents: vi.fn(),
  testSettingsConnection: vi.fn(),
}));

const refreshRuntimeSummary = vi.hoisted(() => vi.fn());
const setThemeMode = vi.hoisted(() => vi.fn());

vi.mock("../../../api", () => apiMocks);

vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => ({
    bootstrap: {
      gateway: { connected: true },
      runtime: { status: "running", health: "healthy" },
    },
    runtime: {
      runtime: {
        status: "running",
        health: "healthy",
        gatewayUrl: "ws://127.0.0.1:18789",
        pid: 1234,
        configured: true,
      },
    },
    themeMode: "light",
    setThemeMode,
    refreshRuntimeSummary,
  }),
}));

let container: HTMLDivElement;
let root: Root | null = null;

function settingsPayload() {
  return {
    path: "/tmp/deck-go.json",
    settings: {
      accessToken: "token",
      managedGateway: {
        mode: "managed",
        command: "pnpm",
        args: ["openclaw", "gateway", "run", "--config", "/tmp/open claw/config.json"],
        workingDir: "/tmp/openclaw",
        bindHost: "127.0.0.1",
        bindPort: 18789,
        gatewayToken: "gateway-token",
        autoStart: false,
        env: { NO_PROXY: "localhost,127.0.0.1" },
      },
    },
  };
}

function devicesPayload() {
  return {
    pending: [
      {
        requestId: "req-1",
        deviceId: "pending-1",
        displayName: "Pending Mac",
        role: "operator",
        ts: Date.now(),
      },
    ],
    paired: [
      {
        deviceId: "self-1",
        displayName: "This Mac",
        roles: ["operator"],
        platform: "darwin",
        remoteIp: "127.0.0.1",
        tokens: [
          {
            role: "operator",
            scopes: ["operator"],
            createdAtMs: 1,
          },
        ],
      },
      {
        deviceId: "dev-1",
        displayName: "Other Mac",
        roles: ["operator"],
        platform: "darwin",
        remoteIp: "10.0.0.2",
        tokens: [
          {
            role: "operator",
            scopes: ["operator"],
            createdAtMs: 1,
          },
        ],
      },
    ],
  };
}

function renderSettingsPanel(locale: "en" | "zh" = "en") {
  return createElement(DeckIntlProvider, { locale }, createElement(SettingsPanel));
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.approveDeviceRequest.mockResolvedValue({ ok: true });
    apiMocks.fetchDevices.mockResolvedValue(devicesPayload());
    apiMocks.fetchSettings.mockResolvedValue(settingsPayload());
    apiMocks.fetchSelfDevice.mockResolvedValue({ deviceId: "self-1" });
    apiMocks.fetchSettingsVersion.mockResolvedValue({
      deck: "deck-v1",
      gateway: "gateway-v1",
      cli: "cli-v1",
    });
    apiMocks.rejectDeviceRequest.mockResolvedValue({ ok: true });
    apiMocks.removeDevice.mockResolvedValue({ ok: true });
    apiMocks.revokeDeviceToken.mockResolvedValue({ ok: true });
    apiMocks.rotateDeviceToken.mockResolvedValue({ token: "rotated-token" });
    apiMocks.saveSettings.mockResolvedValue({ saved: true, path: "/tmp/deck-go.json" });
    apiMocks.streamEvents.mockResolvedValue(undefined);
    apiMocks.testSettingsConnection.mockResolvedValue({ ok: true });
    refreshRuntimeSummary.mockResolvedValue(undefined);
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

  it("loads local settings and renders the deck runtime summary", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));
    await waitFor(() => expect(container.textContent).toContain("Devices ready"));

    expect(container.textContent).toContain("Deck-go local settings");
    expect(container.textContent).toContain("Gateway linked");
    expect(container.textContent).toContain("Runtime running");
    expect(container.textContent).toContain("/tmp/deck-go.json");
    expect(container.textContent).toContain("autoStart: false | managed mode: managed");
    expect(container.textContent).toContain("runtime url: ws://127.0.0.1:18789");
    expect(container.textContent).toContain("deck version: deck-v1");
    expect(container.textContent).toContain("gateway version: gateway-v1");
    expect(container.textContent).toContain("cli version: cli-v1");
    expect(container.textContent).toContain("Connection probe");
    expect(container.textContent).toContain("Appearance");
    expect(container.textContent).toContain("Notifications");
    expect(container.textContent).toContain("Language changes are local");
    expect(container.textContent).toContain("English");
    expect(container.textContent).toContain("中文");
    expect(container.querySelector(".deck-ui-settings")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-settings-card")).toHaveLength(5);
    expect(container.querySelectorAll(".deck-ui-settings-status-row")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-settings-form-row")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-settings-input")).toHaveLength(8);
    expect(container.querySelectorAll(".deck-ui-settings-textarea")).toHaveLength(1);
    expect(container.querySelectorAll(".deck-ui-settings-surface").length).toBeGreaterThanOrEqual(
      5,
    );
    expect(container.querySelectorAll(".deck-ui-settings-row")).toHaveLength(3);
    expect(container.querySelectorAll(".deck-ui-settings-actions").length).toBeGreaterThanOrEqual(
      6,
    );
    expect(container.querySelector("[style]")).toBeNull();
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://docs.openclaw.ai"]'),
    ).toBeTruthy();
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://github.com/openclaw/openclaw"]'),
    ).toBeTruthy();

    const inputs = Array.from(container.querySelectorAll("input"));
    const textInputs = inputs.filter((input) => input.type !== "checkbox");
    const passwordInputs = textInputs.filter((input) => input.type === "password");
    expect(passwordInputs).toHaveLength(2);
    expect(
      textInputs.filter((input) => input.type !== "password").map((input) => input.value),
    ).toEqual([
      "pnpm",
      "/tmp/openclaw",
      "127.0.0.1",
      "18789",
      "ws://127.0.0.1:18789",
      '["openclaw","gateway","run","--config","/tmp/open claw/config.json"]',
    ]);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "NO_PROXY=localhost,127.0.0.1",
    );
    expect((inputs.find((input) => input.type === "checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("restores old Settings appearance theme controls through the Deck UI shell", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Dark")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(setThemeMode).toHaveBeenCalledWith("dark");
  });

  it("renders localized Chinese settings, device, and unavailable notification copy", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel("zh"));
    });

    await waitFor(() => expect(container.textContent).toContain("设置就绪"));
    await waitFor(() => expect(container.textContent).toContain("设备就绪"));

    expect(container.textContent).toContain("Deck-go 本地设置");
    expect(container.textContent).toContain("外观");
    expect(container.textContent).toContain("语言更改仅作用于当前 Deck UI 外壳");
    expect(container.textContent).toContain("通知");
    expect(container.textContent).toContain("尚未暴露持久化通知偏好的 API");
    expect(container.textContent).toContain("已配对设备");
    expect(container.textContent).toContain("待处理请求");
    expect(container.textContent).toContain("批准请求");
  });

  it("saves edited settings, persists the deck token, and refreshes runtime state", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    const inputs = Array.from(container.querySelectorAll("input"));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(inputs[0], { target: { value: "next-token" } });
      fireEvent.change(inputs[1], { target: { value: "bun" } });
      fireEvent.change(inputs[2], { target: { value: "/workspace/openclaw" } });
      fireEvent.change(inputs[3], { target: { value: "gateway-next" } });
      fireEvent.change(inputs[4], { target: { value: "0.0.0.0" } });
      fireEvent.change(inputs[5], { target: { value: "18888" } });
      fireEvent.change(inputs[7], {
        target: {
          value: JSON.stringify([
            "openclaw",
            "gateway",
            "run",
            "--force",
            "--config",
            "path with spaces/config.json",
          ]),
        },
      });
      fireEvent.change(textarea, {
        target: { value: "EXTRA=1\nNO_PROXY=localhost,127.0.0.1" },
      });
      fireEvent.click(inputs.find((input) => input.type === "checkbox") as HTMLInputElement);
    });

    act(() => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Save settings",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() =>
      expect(apiMocks.saveSettings).toHaveBeenCalledWith({
        accessToken: "next-token",
        managedGateway: {
          mode: "managed",
          command: "bun",
          args: [
            "openclaw",
            "gateway",
            "run",
            "--force",
            "--config",
            "path with spaces/config.json",
          ],
          workingDir: "/workspace/openclaw",
          bindHost: "0.0.0.0",
          bindPort: 18888,
          gatewayToken: "gateway-next",
          autoStart: true,
          env: { EXTRA: "1", NO_PROXY: "localhost,127.0.0.1" },
        },
      }),
    );
    expect(apiMocks.persistAccessToken).toHaveBeenCalledWith("next-token");
    expect(apiMocks.fetchSettings).toHaveBeenCalledTimes(2);
    expect(refreshRuntimeSummary).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container.textContent).toContain("Settings save result"));
    expect(container.textContent).toContain('"saved": true');
  });

  it("rejects invalid managed Gateway args instead of whitespace-splitting them", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    const inputs = Array.from(container.querySelectorAll("input"));

    act(() => {
      fireEvent.change(inputs[7], { target: { value: "openclaw gateway run" } });
    });

    expect(container.textContent).toContain("Startup args must be valid JSON.");

    act(() => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Save settings",
        ) as HTMLButtonElement,
      );
    });

    expect(apiMocks.saveSettings).not.toHaveBeenCalled();
  });

  it("tests the configured managed Gateway connection and renders the result", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Test connection")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.testSettingsConnection).toHaveBeenCalledWith(
        "ws://127.0.0.1:18789",
        "gateway-token",
      ),
    );
    expect(container.textContent).toContain("Connection test result");
    expect(container.textContent).toContain('"ok": true');
  });

  it("loads devices and runs confirmed device actions through the device facade", async () => {
    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(apiMocks.fetchDevices).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchSelfDevice).toHaveBeenCalledTimes(1));
    expect(container.textContent).toContain("Pending Mac");
    expect(container.textContent).toContain("This Mac (this device)");
    expect(container.textContent).toContain("Other Mac");

    const pendingItem = Array.from(container.querySelectorAll("li")).find((item) =>
      item.textContent?.includes("Pending Mac"),
    );
    expect(pendingItem).toBeTruthy();
    await act(async () => {
      Array.from(pendingItem?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Approve request")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Approve device pairing request req-1?");
    await act(async () => {
      Array.from(
        container.querySelector(".deck-ui-settings-confirm-dialog")?.querySelectorAll("button") ??
          [],
      )
        .find((button) => button.textContent === "Approve request")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(apiMocks.approveDeviceRequest).toHaveBeenCalledWith("req-1"));

    const otherDevice = Array.from(container.querySelectorAll("li")).find((item) =>
      item.textContent?.includes("Other Mac"),
    );
    expect(otherDevice).toBeTruthy();
    await act(async () => {
      Array.from(otherDevice?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Rotate token")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Rotate operator token for dev-1?");
    await act(async () => {
      Array.from(
        container.querySelector(".deck-ui-settings-confirm-dialog")?.querySelectorAll("button") ??
          [],
      )
        .find((button) => button.textContent === "Rotate token")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.rotateDeviceToken).toHaveBeenCalledWith("dev-1", "operator"),
    );
    expect(container.textContent).toContain("New token generated");
    expect(container.textContent).toContain("rotated-token");
    await act(async () => {
      Array.from(
        container.querySelector(".deck-ui-settings-token-dialog")?.querySelectorAll("button") ?? [],
      )
        .find((button) => button.textContent === "Close")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(otherDevice?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Revoke token")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Revoke operator token for dev-1?");
    await act(async () => {
      Array.from(
        container.querySelector(".deck-ui-settings-confirm-dialog")?.querySelectorAll("button") ??
          [],
      )
        .find((button) => button.textContent === "Revoke token")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.revokeDeviceToken).toHaveBeenCalledWith("dev-1", "operator"),
    );

    await act(async () => {
      Array.from(otherDevice?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Remove device")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Remove paired device dev-1?");
    await act(async () => {
      Array.from(
        container.querySelector(".deck-ui-settings-confirm-dialog")?.querySelectorAll("button") ??
          [],
      )
        .find((button) => button.textContent === "Remove device")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(apiMocks.removeDevice).toHaveBeenCalledWith("dev-1"));
    expect(container.textContent).toContain("Last device action");
  });

  it("refreshes devices when the old device pairing SSE events arrive", async () => {
    apiMocks.streamEvents.mockImplementationOnce(
      async (params: {
        onEvent: (event: { event?: string; data?: string; json?: unknown }) => void;
      }) => {
        params.onEvent({
          event: "device.pair.requested",
          data: JSON.stringify({ displayName: "Stream Mac", role: "operator" }),
        });
      },
    );

    act(() => {
      root = createRoot(container);
      root.render(renderSettingsPanel());
    });

    await waitFor(() => expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchDevices).toHaveBeenCalledTimes(2));
    expect(container.textContent).toContain(
      "Last device stream event: device.pair.requested: Stream Mac (operator)",
    );
  });
});
