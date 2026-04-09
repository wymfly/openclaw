import type { Page, Route } from "@playwright/test";

const DASHBOARD_ORIGIN = "http://localhost:3000";

type TestUiStoreHandle = {
  getState: () => {
    setActivePanel: (panel: string) => void;
  };
};

type TestWindow = Window & {
  __TEST_UI_STORE__?: TestUiStoreHandle;
  __TEST_FORCE_PANEL_ERROR__?: string | null;
};

type ShellMockOptions = {
  needsOnboarding?: boolean;
  gatewayStatus?: string;
  settings?: Record<string, unknown>;
  streamStatus?: number;
  streamBody?: string;
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

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await waitForUiStore(page);
}

export async function waitForUiStore(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const win = window as TestWindow;
    return Boolean(win.__TEST_UI_STORE__);
  });
}

export async function setActivePanel(page: Page, panelId: string): Promise<void> {
  await waitForUiStore(page);
  await page.evaluate((panel) => {
    const win = window as TestWindow;
    win.__TEST_UI_STORE__?.getState().setActivePanel(panel);
  }, panelId);
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
