// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SettingsPanel } from "./SettingsPanel";

const apiMocks = vi.hoisted(() => ({
  approveDeviceRequest: vi.fn(),
  fetchDevices: vi.fn(),
  fetchCapabilities: vi.fn(),
  fetchEndpoint: vi.fn(),
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
  testEndpoint: vi.fn(),
  updateEndpoint: vi.fn(),
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
      accessTokenConfigured: true,
      accessTokenSource: "env",
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
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale }, createElement(SettingsPanel)),
      ),
    );
  });
}

function buttons() {
  return Array.from(container.querySelectorAll("button"));
}

function clickButton(text: string) {
  const button = buttons().find(
    (entry) => entry.textContent === text || entry.textContent?.includes(text),
  );
  expect(button, `button ${text}`).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickButtonAsync(text: string) {
  const button = buttons().find(
    (entry) => entry.textContent === text || entry.textContent?.includes(text),
  );
  expect(button, `button ${text}`).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.approveDeviceRequest.mockResolvedValue({ ok: true });
    apiMocks.fetchCapabilities.mockResolvedValue({
      mode: "bundled",
      configured: true,
      endpointMutable: false,
      supervisorState: true,
    });
    apiMocks.fetchDevices.mockResolvedValue(devicesPayload());
    apiMocks.fetchEndpoint.mockResolvedValue({
      url: "ws://127.0.0.1:18789",
      tokenConfigured: true,
      tlsVerify: false,
      source: "env",
    });
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
    apiMocks.saveSettings.mockResolvedValue({ ok: true, settings: settingsPayload().settings });
    apiMocks.streamEvents.mockResolvedValue(undefined);
    apiMocks.testEndpoint.mockResolvedValue({ ok: true, tlsVerified: false });
    apiMocks.updateEndpoint.mockResolvedValue({
      url: "http://remote-gateway:18789",
      tokenConfigured: true,
      tlsVerify: true,
      source: "json",
    });
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

  it("loads the prototype-shaped settings section rail and identity group", async () => {
    renderSettingsPanel();

    await waitFor(() => expect(apiMocks.fetchSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));
    await waitFor(() => expect(container.textContent).toContain("Devices ready"));

    expect(container.textContent).toContain("Control / app preferences");
    expect(container.textContent).toContain("Identity & access");
    expect(container.textContent).toContain("Runtime");
    expect(container.textContent).toContain("Appearance");
    expect(container.textContent).toContain("Notifications");
    expect(container.textContent).toContain("Paired devices");
    expect(container.textContent).toContain("Version");
    expect(container.textContent).toContain("Deck access token");
    expect(container.textContent).toContain("read-only");
    expect(container.textContent).toContain("/tmp/deck-go.json");
    expect(container.querySelector(".settings-nav")).toBeTruthy();
    expect(container.querySelector(".setting-group")).toBeTruthy();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("filters the section rail and recovers from a no-match state", async () => {
    renderSettingsPanel();
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).toBeTruthy();
    act(() => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "zzzz" } });
    });
    expect(container.textContent).toContain("No sections match.");

    act(() => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "runtime" } });
    });
    expect(container.textContent).toContain("Bundled or remote Gateway endpoint");
  });

  it("saves only safe local preferences from the Appearance section", async () => {
    renderSettingsPanel();
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    clickButton("AppearanceTheme, density, motion and language");
    clickButton("Dark");
    expect(setThemeMode).toHaveBeenCalledWith("dark");
    expect(container.textContent).toContain("1 unsaved");

    clickButton("Save (1)");
    expect(container.textContent).toContain("Save settings");
    await act(async () => {
      Array.from(container.querySelector(".settings-save-dialog")?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "Save (1)")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.saveSettings).toHaveBeenCalledWith({
        appearance: {
          density: "compact",
          fontSize: 14,
          reducedMotion: false,
          theme: "dark",
        },
        notifications: {
          desktop: true,
          quietHoursEnabled: false,
          quietHoursEnd: "08:00",
          quietHoursStart: "22:00",
          sound: false,
        },
        pairedDevices: [],
      }),
    );
    expect(apiMocks.persistAccessToken).not.toHaveBeenCalled();
    expect(refreshRuntimeSummary).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Last save result");
  });

  it("renders localized Chinese settings and section chrome", async () => {
    renderSettingsPanel("zh");

    await waitFor(() => expect(container.textContent).toContain("设置就绪"));
    expect(container.textContent).toContain("身份与访问");
    expect(container.textContent).toContain("运行时");
    expect(container.textContent).toContain("外观");
    expect(container.textContent).toContain("通知");
    expect(container.textContent).toContain("已配对设备");

    clickButton("外观主题、密度、动画和语言");
    expect(container.textContent).toContain("语言更改仅作用于当前 Deck UI 外壳");
  });

  it("preserves bundled endpoint immutability in the Runtime section", async () => {
    renderSettingsPanel();
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));

    clickButton("RuntimeBundled or remote Gateway endpoint");
    await waitFor(() => expect(container.textContent).toContain("Runtime endpoint"));

    expect(container.textContent).toContain("set via .env");
    expect(container.textContent).toContain("Bundled mode is owned by .env");
    expect(buttons().find((button) => button.textContent === "Test endpoint")).toBeUndefined();
    expect(apiMocks.testEndpoint).not.toHaveBeenCalled();
  });

  it("saves a remote endpoint with the explicit token-preserve sentinel", async () => {
    apiMocks.fetchCapabilities.mockResolvedValue({
      mode: "remote",
      configured: true,
      endpointMutable: true,
      supervisorState: false,
    });
    apiMocks.fetchEndpoint.mockResolvedValue({
      url: "http://old-gateway:18789",
      tokenConfigured: true,
      tlsVerify: false,
      source: "env",
    });

    renderSettingsPanel();
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));
    clickButton("RuntimeBundled or remote Gateway endpoint");
    await waitFor(() => expect(container.textContent).toContain("Save endpoint"));

    const urlInput = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
      (input) => input.value === "http://old-gateway:18789",
    );
    expect(urlInput).toBeTruthy();
    act(() => {
      fireEvent.change(urlInput as HTMLInputElement, {
        target: { value: "http://remote-gateway:18789" },
      });
    });
    await clickButtonAsync("Save endpoint");

    await waitFor(() =>
      expect(apiMocks.updateEndpoint).toHaveBeenCalledWith({
        url: "http://remote-gateway:18789",
        token: "__unchanged__",
        tlsVerify: false,
      }),
    );
    expect(refreshRuntimeSummary).toHaveBeenCalledTimes(1);
  });

  it("tests an unchanged remote endpoint using the active configuration", async () => {
    apiMocks.fetchCapabilities.mockResolvedValue({
      mode: "remote",
      configured: true,
      endpointMutable: true,
      supervisorState: false,
    });
    apiMocks.fetchEndpoint.mockResolvedValue({
      url: "http://old-gateway:18789",
      tokenConfigured: true,
      tlsVerify: false,
      source: "env",
    });

    renderSettingsPanel();
    await waitFor(() => expect(container.textContent).toContain("Settings ready"));
    clickButton("RuntimeBundled or remote Gateway endpoint");
    await waitFor(() => expect(container.textContent).toContain("Test endpoint"));
    await clickButtonAsync("Test endpoint");

    await waitFor(() => expect(apiMocks.testEndpoint).toHaveBeenCalledWith(undefined));
  });

  it("loads devices and runs confirmed device actions through the device facade", async () => {
    renderSettingsPanel();
    await waitFor(() => expect(apiMocks.fetchDevices).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchSelfDevice).toHaveBeenCalledTimes(1));

    clickButton("Paired devicesDevice sessions and token actions");
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
        container.querySelector(".settings-confirm-dialog")?.querySelectorAll("button") ?? [],
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
        container.querySelector(".settings-confirm-dialog")?.querySelectorAll("button") ?? [],
      )
        .find((button) => button.textContent === "Rotate token")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.rotateDeviceToken).toHaveBeenCalledWith("dev-1", "operator"),
    );
    expect(container.textContent).toContain("New token generated");
    expect(container.textContent).toContain("rotated-token");
  });

  it("refreshes devices when the device pairing SSE events arrive", async () => {
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

    renderSettingsPanel();
    await waitFor(() => expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchDevices).toHaveBeenCalledTimes(2));
    clickButton("Paired devicesDevice sessions and token actions");
    expect(container.textContent).toContain(
      "Last device stream event: device.pair.requested: Stream Mac (operator)",
    );
  });
});
