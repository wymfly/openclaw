import type { Page, Route } from "@playwright/test";
import {
  buildChannelProbePayload,
  buildChannelsStatusPayload,
  buildConfigReadPayload,
  buildConfigSchemaPayload,
  buildPluginsInventoryPayload,
  buildRoutingPayload,
  deepMergeRecord,
  type MockChannelDefinition,
  type MockPluginInventoryEntry,
  type MockRoutingBinding,
} from "./channel-fixtures";

const DASHBOARD_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

type TestUiStoreHandle = {
  getState: () => {
    setActivePanel: (panel: string) => void;
  };
};

type TestWindow = Window & {
  __TEST_UI_STORE__?: TestUiStoreHandle;
  __TEST_FORCE_PANEL_ERROR__?: string | null;
};

const PANEL_LABELS: Record<string, string> = {
  chat: "Chat",
  agents: "Agents",
  gateway: "Monitor",
  models: "Models",
  usage: "Usage",
  sessions: "Sessions",
  memory: "Memory",
  logs: "Logs",
  activity: "Activity",
  threads: "Threads",
  "api-explorer": "API Explorer",
  cron: "Cron Jobs",
  webhooks: "Webhooks",
  approvals: "Approvals",
  skills: "Skills",
  budget: "Budget",
  alerts: "Alerts",
  channels: "Channels",
  plugins: "Plugins",
  routing: "Routing",
  subagents: "Subagents",
  identity: "Identities",
  config: "Config",
  nodes: "Nodes",
  docs: "Docs",
  settings: "Settings",
};

type ShellMockOptions = {
  needsOnboarding?: boolean;
  gatewayStatus?: string;
  settings?: Record<string, unknown>;
  streamStatus?: number;
  streamBody?: string;
};

type MockChannelWorkspaceOptions = ShellMockOptions & {
  channels: MockChannelDefinition[];
  plugins?: MockPluginInventoryEntry[];
  bindings?: MockRoutingBinding[];
  config?: Record<string, unknown>;
  schemaOnlyChannelIds?: string[];
  channelTestResults?: Record<
    string,
    {
      ok?: boolean;
      error?: string;
      check?: string;
    }
  >;
};

type ConfigPatchRequest = {
  patch?: Record<string, unknown>;
  baseHash?: string | null;
};

type ChannelTestRequest = {
  channelId: string;
  body: unknown;
};

type ChannelUpdateRequest = {
  channelId: string;
  body: unknown;
};

export type MockChannelWorkspaceHarness = {
  configPatchRequests: ConfigPatchRequest[];
  channelTestRequests: ChannelTestRequest[];
  channelUpdateRequests: ChannelUpdateRequest[];
  getConfig: () => Record<string, unknown>;
};

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function setEnglishLocale(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      url: DASHBOARD_ORIGIN,
    },
  ]);
}

export async function stubDashboardShell(
  page: Page,
  options: ShellMockOptions = {},
): Promise<void> {
  const {
    needsOnboarding = false,
    gatewayStatus = "disconnected",
    settings = {},
    streamStatus = 200,
    streamBody = ": open\n\n",
  } = options;

  await page.route("**/api/onboarding/status", (route) => fulfillJson(route, { needsOnboarding }));

  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "GET") {
      return fulfillJson(route, settings);
    }
    return fulfillJson(route, { ok: true });
  });

  await page.route("**/api/gateway/status", (route) =>
    fulfillJson(route, { status: gatewayStatus }),
  );

  await page.route("**/api/deck/commands/discover", (route) =>
    fulfillJson(route, { commands: [] }),
  );

  await page.route("**/api/stream", (route) => {
    if (streamStatus !== 200) {
      return route.fulfill({
        status: streamStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "stream unavailable" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: streamBody,
      headers: {
        "cache-control": "no-cache",
      },
    });
  });
}

function buildDefaultConfig(channels: MockChannelDefinition[]): Record<string, unknown> {
  return {
    channels: Object.fromEntries(channels.map((channel) => [channel.id, {}])),
  };
}

function nextConfigHash(counter: number): string {
  return `test-config-hash-${counter}`;
}

function extractChannelIdFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const channelIdIndex = segments.findIndex((segment) => segment === "channels") + 1;
  return decodeURIComponent(segments[channelIdIndex] ?? "");
}

export async function stubChannelWorkspace(
  page: Page,
  options: MockChannelWorkspaceOptions,
): Promise<MockChannelWorkspaceHarness> {
  const {
    channels,
    plugins = [],
    bindings = [],
    schemaOnlyChannelIds = [],
    channelTestResults = {},
    ...shellOptions
  } = options;
  const configPatchRequests: ConfigPatchRequest[] = [];
  const channelTestRequests: ChannelTestRequest[] = [];
  const channelUpdateRequests: ChannelUpdateRequest[] = [];
  let configHashVersion = 1;
  let currentConfig = deepMergeRecord(buildDefaultConfig(channels), options.config ?? {});

  await stubDashboardShell(page, shellOptions);

  await page.route(/\/api\/config\/schema(?:\?.*)?$/, (route) =>
    fulfillJson(
      route,
      buildConfigSchemaPayload([...channels.map((channel) => channel.id), ...schemaOnlyChannelIds]),
    ),
  );

  await page.route(/\/api\/config(?:\?.*)?$/, (route) =>
    fulfillJson(route, buildConfigReadPayload(currentConfig, nextConfigHash(configHashVersion))),
  );

  await page.route(/\/api\/config\/patch(?:\?.*)?$/, async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as {
      patch?: Record<string, unknown>;
      baseHash?: string | null;
    };
    configPatchRequests.push({
      patch: body.patch,
      baseHash: body.baseHash ?? null,
    });
    if (body.patch) {
      currentConfig = deepMergeRecord(currentConfig, body.patch);
    }
    configHashVersion += 1;
    await fulfillJson(route, {
      ok: true,
      baseHash: nextConfigHash(configHashVersion),
    });
  });

  await page.route(/\/api\/channels\/probe(?:\?.*)?$/, (route) =>
    fulfillJson(route, buildChannelProbePayload(channels)),
  );

  await page.route(/\/api\/channels(?:\?.*)?$/, (route) => {
    const url = route.request().url();
    if (url.includes("probe=true")) {
      return fulfillJson(route, buildChannelsStatusPayload(channels));
    }
    return fulfillJson(route, buildChannelsStatusPayload(channels));
  });

  await page.route(/\/api\/channels\/[^/]+\/test(?:\?.*)?$/, async (route) => {
    const channelId = extractChannelIdFromUrl(route.request().url());
    channelTestRequests.push({
      channelId,
      body: route.request().postDataJSON() ?? null,
    });
    const result = channelTestResults[channelId] ?? { ok: true, check: "probe" };
    await fulfillJson(route, result);
  });

  await page.route(/\/api\/channels\/[^/]+(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "PATCH") {
      return route.fallback();
    }
    const channelId = extractChannelIdFromUrl(route.request().url());
    const body = route.request().postDataJSON() ?? {};
    channelUpdateRequests.push({ channelId, body });
    await fulfillJson(route, { ok: true });
  });

  await page.route(/\/api\/deck\/plugins(?:\?.*)?$/, (route) =>
    fulfillJson(route, buildPluginsInventoryPayload(plugins)),
  );

  await page.route(/\/api\/deck\/routing(?:\?.*)?$/, (route) => {
    if (route.request().method() === "GET") {
      return fulfillJson(route, buildRoutingPayload(bindings));
    }
    return fulfillJson(route, { ok: true });
  });

  return {
    configPatchRequests,
    channelTestRequests,
    channelUpdateRequests,
    getConfig: () => currentConfig,
  };
}

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("nav").waitFor({ state: "visible" });
}

export async function waitForUiStore(page: Page, timeout = 5_000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const win = window as TestWindow;
        return Boolean(win.__TEST_UI_STORE__);
      },
      undefined,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

export async function setActivePanel(page: Page, panelId: string): Promise<void> {
  if (await waitForUiStore(page, 1_000)) {
    await page.evaluate((panel) => {
      const win = window as TestWindow;
      win.__TEST_UI_STORE__?.getState().setActivePanel(panel);
    }, panelId);
    return;
  }

  const label = PANEL_LABELS[panelId];
  if (!label) {
    throw new Error(`No panel label mapping for ${panelId}`);
  }
  await page.locator("nav").getByRole("button", { name: label, exact: true }).click();
}

export async function forcePanelError(page: Page, panelId: string | null): Promise<void> {
  await page.evaluate((panel) => {
    const win = window as TestWindow;
    if (panel) {
      win.__TEST_FORCE_PANEL_ERROR__ = panel;
      return;
    }
    delete win.__TEST_FORCE_PANEL_ERROR__;
  }, panelId);
}
