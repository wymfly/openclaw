import { expect, test, type APIResponse, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  seedRealGatewayChat,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

type UsageSessionEntry = {
  key?: unknown;
  label?: unknown;
  sessionId?: unknown;
  updatedAt?: unknown;
  agentId?: unknown;
  channel?: unknown;
  usage?: unknown;
  contextWeight?: unknown;
};

type Variant = {
  context: string;
  empty: string;
  logs: string;
  navLabel: string;
  ready: RegExp;
  searchPlaceholder: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  timeseries: string;
  title: string;
};

const VARIANTS: Variant[] = [
  {
    context: "Context",
    empty: "No session usage matched.",
    logs: "Logs",
    navLabel: "Usage",
    ready: /Usage ready/,
    searchPlaceholder: "search usage sessions",
    theme: "dark",
    locale: "en",
    timeseries: "Timeseries",
    title: "Usage operations cockpit",
  },
  {
    context: "上下文",
    empty: "没有匹配的会话用量。",
    logs: "日志",
    navLabel: "用量",
    ready: /用量.*就绪/,
    searchPlaceholder: "搜索用量会话",
    theme: "dark",
    locale: "zh",
    timeseries: "时间序列",
    title: "用量运营驾驶舱",
  },
  {
    context: "Context",
    empty: "No session usage matched.",
    logs: "Logs",
    navLabel: "Usage",
    ready: /Usage ready/,
    searchPlaceholder: "search usage sessions",
    theme: "light",
    locale: "en",
    timeseries: "Timeseries",
    title: "Usage operations cockpit",
  },
  {
    context: "上下文",
    empty: "没有匹配的会话用量。",
    logs: "日志",
    navLabel: "用量",
    ready: /用量.*就绪/,
    searchPlaceholder: "搜索用量会话",
    theme: "light",
    locale: "zh",
    timeseries: "时间序列",
    title: "用量运营驾驶舱",
  },
];

test.describe("usage real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the usage real Gateway E2E",
  );
  test.setTimeout(360_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies route shapes, seeded/sparse data, UI variants, and BFF-only transport", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId = stack.realE2E?.runId ?? "real-usage";
    const routeEvidence: JsonObject = { runId };

    const seedEvidence = await seedRealGatewayChat(request, stack, testInfo, { maxAttempts: 2 });
    routeEvidence.seed = {
      status: seedEvidence.status,
      sessionStatus: seedEvidence.sessionStatus,
      session: seedEvidence.session ?? null,
    };

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
    routeEvidence.runtime = await responseShape(runtime);

    const bootstrap = await request.get(`${stack.backendBase}/api/bootstrap/status`, { headers });
    expect(bootstrap.ok(), `/bootstrap/status returned ${bootstrap.status()}`).toBe(true);
    const bootstrapShape = await responseShape(bootstrap);
    expect(typeof bootstrapShape.payload?.ok).toBe("boolean");
    routeEvidence.bootstrap = bootstrapShape;

    const cost = await request.get(`${stack.backendBase}/api/usage/cost?days=14`, { headers });
    expect(cost.ok(), `/usage/cost returned ${cost.status()}`).toBe(true);
    const costShape = await responseShape(cost);
    expect(Array.isArray(costShape.payload?.daily)).toBe(true);
    routeEvidence.cost = {
      ...costShape,
      dailyCount: Array.isArray(costShape.payload?.daily) ? costShape.payload.daily.length : 0,
    };

    const providers = await request.get(`${stack.backendBase}/api/usage/providers`, { headers });
    expect(providers.ok(), `/usage/providers returned ${providers.status()}`).toBe(true);
    const providersShape = await responseShape(providers);
    expect(Array.isArray(providersShape.payload?.providers)).toBe(true);
    routeEvidence.providers = {
      ...providersShape,
      providerCount: Array.isArray(providersShape.payload?.providers)
        ? providersShape.payload.providers.length
        : 0,
    };

    const legacyCost = await request.get(`${stack.backendBase}/api/models/usage/cost?days=7`, {
      headers,
    });
    expect(legacyCost.ok(), `/models/usage/cost returned ${legacyCost.status()}`).toBe(true);
    routeEvidence.legacyCost = await responseShape(legacyCost);

    const legacyProviders = await request.get(`${stack.backendBase}/api/models/usage/providers`, {
      headers,
    });
    expect(
      legacyProviders.ok(),
      `/models/usage/providers returned ${legacyProviders.status()}`,
    ).toBe(true);
    routeEvidence.legacyProviders = await responseShape(legacyProviders);

    const sessions = await request.get(
      `${stack.backendBase}/api/usage/sessions?limit=20&includeContextWeight=true`,
      { headers },
    );
    expect(sessions.ok(), `/usage/sessions returned ${sessions.status()}`).toBe(true);
    const sessionsShape = await responseShape(sessions);
    const sessionRows = Array.isArray(sessionsShape.payload?.sessions)
      ? (sessionsShape.payload.sessions as UsageSessionEntry[])
      : [];
    validateUsageSessionRows(sessionRows);
    routeEvidence.sessions = {
      ...sessionsShape,
      rowCount: sessionRows.length,
      sampleKey: sessionRows[0]?.key ?? null,
    };

    const firstSessionKey = sessionRows.find((entry) => typeof entry.key === "string")?.key;
    if (typeof firstSessionKey === "string") {
      const logs = await request.get(
        `${stack.backendBase}/api/usage/sessions/logs?key=${encodeURIComponent(firstSessionKey)}&limit=20`,
        { headers },
      );
      expect(logs.ok(), `/usage/sessions/logs returned ${logs.status()}`).toBe(true);
      const logsShape = await responseShape(logs);
      expect(Array.isArray(logsShape.payload?.logs ?? [])).toBe(true);

      const timeseries = await request.get(
        `${stack.backendBase}/api/usage/timeseries?key=${encodeURIComponent(firstSessionKey)}`,
        { headers },
      );
      expect(timeseries.ok(), `/usage/timeseries returned ${timeseries.status()}`).toBe(true);
      const timeseriesShape = await responseShape(timeseries);
      expect(Array.isArray(timeseriesShape.payload?.points)).toBe(true);

      routeEvidence.sessionDetail = {
        key: firstSessionKey,
        logs: {
          ...logsShape,
          rowCount: Array.isArray(logsShape.payload?.logs) ? logsShape.payload.logs.length : 0,
        },
        timeseries: {
          ...timeseriesShape,
          pointCount: Array.isArray(timeseriesShape.payload?.points)
            ? timeseriesShape.payload.points.length
            : 0,
        },
        status: "selected-session-verified",
      };
    } else {
      routeEvidence.sessionDetail = {
        status: "empty-valid",
        reason: "real stack exposed no usage sessions after bounded cpa/main seed",
      };
    }

    const uiEvidence: JsonObject[] = [];
    for (const variant of VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = recordUnexpected(page, stack.backendBase);
      const directGateway = collectDirectGateway(page, stack);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const usageNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await usageNav.scrollIntoViewIfNeeded();
        await usageNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "usage");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("usage-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();
        await expect(panel.getByText(/Usage trend|用量趋势/).first()).toBeVisible();
        await expect(panel.getByText(/Provider quotas|供应商配额/).first()).toBeVisible();

        const rowCount = await panel
          .locator(".usage-panel__sessions > .usage-panel__list > li")
          .count();
        if (rowCount > 0) {
          await panel
            .locator(".usage-panel__sessions > .usage-panel__list > li button")
            .first()
            .click();
          await panel.getByRole("tab", { name: variant.logs }).click();
          await expect(panel.getByText(/Session logs|会话日志/)).toBeVisible();
          await panel.getByRole("tab", { name: variant.timeseries }).click();
          await expect(panel.getByText(/Usage timeseries|用量时间序列/)).toBeVisible();
          await panel.getByRole("tab", { name: variant.context }).click();
          await expect(panel.getByText(/Context weight|上下文权重/)).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(panel.getByText(/Open usage session|打开用量会话/)).toHaveCount(0);
        } else {
          await expect(panel.getByText(variant.empty)).toBeVisible();
        }

        await panel.getByPlaceholder(variant.searchPlaceholder).fill(`no-such-usage-${runId}`);
        await expect(panel.locator(".usage-panel__sessions > .usage-panel__list > li")).toHaveCount(
          0,
        );
        await expect(panel.getByText(variant.empty)).toBeVisible();

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          locale: variant.locale,
          navigation: "chat-to-usage",
          rowCount,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    const evidence: JsonObject = {
      routeEvidence,
      runId,
      scenarioId: "usage.real.product-surface",
      status: sessionRows.length > 0 ? "passed" : "empty-valid",
      unsupported: {
        billingAccuracy: "skipped-safe: Gateway exposes estimates, not invoice-grade truth",
        forecasts: "skipped-safe: no usage forecast contract",
        quotaMutation: "skipped-safe: Usage is read-only",
        tenantAccounting: "skipped-safe: no tenant accounting contract",
      },
      uiEvidence,
    };
    await writeRealE2EScenarioEvidence(stack, "usage-real-product-surface", evidence, testInfo);
  });
});

function validateUsageSessionRows(rows: UsageSessionEntry[]) {
  for (const row of rows) {
    expect(typeof row.key).toBe("string");
    if (row.label !== undefined) {
      expect(typeof row.label).toBe("string");
    }
    if (row.sessionId !== undefined) {
      expect(typeof row.sessionId).toBe("string");
    }
    if (row.updatedAt !== undefined) {
      expect(typeof row.updatedAt).toBe("number");
    }
    if (row.agentId !== undefined) {
      expect(typeof row.agentId).toBe("string");
    }
    if (row.channel !== undefined) {
      expect(typeof row.channel).toBe("string");
    }
    if (row.usage !== null && row.usage !== undefined) {
      expect(typeof row.usage).toBe("object");
    }
  }
}

async function responseShape(response: APIResponse): Promise<{
  keys: string[];
  payload?: JsonObject;
  status: number;
}> {
  const text = await response.text();
  let payload: JsonObject | undefined;
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as JsonObject;
    }
  } catch {
    payload = { raw: text.slice(0, 400) };
  }
  return {
    keys: payload ? Object.keys(payload).toSorted() : [],
    payload,
    status: response.status(),
  };
}

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected = {
    apiErrors: [] as string[],
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.consoleErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.pageErrors.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}

function collectDirectGateway(page: Page, stack: E2EStack) {
  const directGateway = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      directGateway.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
      directGateway.websockets.push(websocket.url());
    }
  });
  return directGateway;
}
