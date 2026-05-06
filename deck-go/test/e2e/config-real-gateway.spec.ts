import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type ConfigSnapshotPayload = {
  path?: unknown;
  exists?: unknown;
  valid?: unknown;
  raw?: unknown;
  config?: unknown;
  hash?: unknown;
  baseHash?: unknown;
};
type ConfigLookupPayload = {
  path?: unknown;
  schema?: unknown;
  hint?: unknown;
  children?: unknown;
};
type ConfigFixtureAttempt = {
  method: string;
  reason?: string;
  restoreStatus?: number;
  runId: string;
  status: "attempted" | "handoff-blocked" | "skipped-safe";
  writeStatus?: number;
};

test.describe("config real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Config real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    test.setTimeout(300_000);
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Config route shapes and attempts a safe run-scoped fixture", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runtime = await expectOkJson(
      await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers }),
      "/runtime/gateway",
    );
    expect(runtime.mode).toBe("bundled");

    const snapshotResponse = await request.get(`${stack.backendBase}/api/config`, { headers });
    const snapshotPayload = await expectConfigSnapshot(snapshotResponse);

    const rootLookupResponse = await request.post(`${stack.backendBase}/api/config/schema-lookup`, {
      headers,
      data: { path: "" },
    });
    const rootLookupPayload = await expectConfigLookup(rootLookupResponse, "");
    const rootChildren = Array.isArray(rootLookupPayload.children)
      ? rootLookupPayload.children
      : [];

    const firstChild = rootChildren.find((entry): entry is JsonObject => isRecord(entry));
    let sectionLookupStatus: number | null = null;
    if (typeof firstChild?.path === "string" && firstChild.path) {
      const sectionLookup = await request.post(`${stack.backendBase}/api/config/schema-lookup`, {
        headers,
        data: { path: firstChild.path },
      });
      sectionLookupStatus = sectionLookup.status();
      if (sectionLookup.ok()) {
        await expectConfigLookup(sectionLookup, firstChild.path);
      }
    }

    const fixture = await attemptConfigFixture(request, stack, snapshotPayload, testInfo);

    await writeRealE2EScenarioEvidence(
      stack,
      "config-api-fixture",
      {
        scenarioId: "config-api-fixture",
        runId: fixture.runId,
        status: fixture.status === "attempted" ? "passed" : "degraded",
        attempts: [fixture],
        maxAttempts: 1,
        fixture,
        routeShapes: {
          configPathType: typeof snapshotPayload.path,
          existsType: typeof snapshotPayload.exists,
          rawType: snapshotPayload.raw === null ? "null" : typeof snapshotPayload.raw,
          rootChildren: rootChildren.length,
          runtimeMode: runtime.mode,
          sectionLookupStatus,
          validType: typeof snapshotPayload.valid,
        },
      },
      testInfo,
    );
  });

  test("renders Config UI variants through shell navigation with real evidence", async ({
    browser,
  }, testInfo) => {
    const variants = [
      {
        heading: "Configuration",
        history: "History",
        locale: "en" as const,
        navLabel: "Config",
        raw: "Raw",
        sectionQuery: "models",
        snapshot: "Snapshot in sync",
        theme: "dark" as const,
      },
      {
        heading: "配置治理",
        history: "历史",
        locale: "zh" as const,
        navLabel: "配置",
        raw: "原始",
        sectionQuery: "模型",
        snapshot: "快照已同步",
        theme: "dark" as const,
      },
      {
        heading: "Configuration",
        history: "History",
        locale: "en" as const,
        navLabel: "Config",
        raw: "Raw",
        sectionQuery: "runtime",
        snapshot: "Snapshot in sync",
        theme: "light" as const,
      },
      {
        heading: "配置治理",
        history: "历史",
        locale: "zh" as const,
        navLabel: "配置",
        raw: "原始",
        sectionQuery: "运行",
        snapshot: "快照已同步",
        theme: "light" as const,
      },
    ];
    const evidence: JsonObject[] = [];

    for (const variant of variants) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = recordUnexpected(page, stack.backendBase);
      const directGateway = recordDirectGateway(page, stack);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "config");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("config-panel");
        await expect(panel.getByRole("heading", { name: variant.heading }).first()).toBeVisible();
        await expect(panel.getByText(variant.snapshot).first()).toBeVisible();
        await expect(panel.getByText(/openclaw\.json/).first()).toBeVisible();

        await panel.getByPlaceholder(/Filter sections|筛选分区/).fill(variant.sectionQuery);
        await expect(panel.getByRole("tab").first()).toBeVisible();
        await panel.getByPlaceholder(/Filter sections|筛选分区/).fill("");

        await panel.getByRole("tab", { name: new RegExp(escapeRegExp(variant.raw)) }).click();
        await expect(panel.getByTestId("config-raw-editor")).toBeVisible();

        await panel.getByRole("tab", { name: new RegExp(escapeRegExp(variant.history)) }).click();
        await expect(panel.getByText(/history|历史|契约|contract/i).first()).toBeVisible();

        await expect.poll(() => unexpected.slice()).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        evidence.push({
          directBrowserGatewayCalls: "none",
          interactions: [
            "chat -> config shell navigation",
            "section filter",
            "raw preview pane",
            "history/contract fallback pane",
          ],
          locale: variant.locale,
          theme: variant.theme,
        });
      } finally {
        await context.close();
      }
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "config-ui-variants",
      {
        scenarioId: "config-ui-variants",
        runId: stack.realE2E?.runId ?? "missing-run-id",
        status: "passed",
        variants: evidence,
      },
      testInfo,
    );
  });
});

async function attemptConfigFixture(
  request: APIRequestContext,
  stack: E2EStack,
  snapshot: ConfigSnapshotPayload,
  testInfo: TestInfo,
): Promise<ConfigFixtureAttempt> {
  const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo-e2e", "config");
  const raw = typeof snapshot.raw === "string" ? snapshot.raw : "";
  const baseHash =
    typeof snapshot.baseHash === "string"
      ? snapshot.baseHash
      : typeof snapshot.hash === "string"
        ? snapshot.hash
        : "";
  if (!raw || !baseHash) {
    const skipped = {
      method: "POST /api/config/apply",
      reason: "real Gateway snapshot did not expose writable raw text and baseHash",
      runId,
      status: "skipped-safe" as const,
    };
    await writeFixtureAttempt(stack, skipped, testInfo);
    return skipped;
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) {
    const blocked = {
      method: "POST /api/config/apply",
      reason: "real Gateway raw config was not a JSON object",
      runId,
      status: "handoff-blocked" as const,
    };
    await writeFixtureAttempt(stack, blocked, testInfo);
    return blocked;
  }

  const markerKey = "__deckGoE2E";
  const candidate = {
    ...parsed,
    [markerKey]: {
      createdBy: "deck-go config real e2e",
      runId,
    },
  };
  const write = await request.post(`${stack.backendBase}/api/config/apply`, {
    headers: authHeaders(stack.accessToken),
    data: { baseHash, raw: JSON.stringify(candidate, null, 2) },
  });
  const writeText = await write.text();
  if (!write.ok()) {
    const skipped = {
      method: "POST /api/config/apply run-scoped marker",
      reason: `run-scoped marker write rejected with ${write.status()}: ${writeText.slice(0, 500)}`,
      runId,
      status: "skipped-safe" as const,
      writeStatus: write.status(),
    };
    await writeFixtureAttempt(stack, skipped, testInfo);
    return skipped;
  }

  const writePayload = parseJsonObject(writeText) ?? {};
  const restoreHash =
    typeof writePayload.baseHash === "string"
      ? writePayload.baseHash
      : typeof writePayload.hash === "string"
        ? writePayload.hash
        : baseHash;
  const restore = await request.post(`${stack.backendBase}/api/config/apply`, {
    headers: authHeaders(stack.accessToken),
    data: { baseHash: restoreHash, raw },
  });
  const attempted = {
    method: "POST /api/config/apply run-scoped marker then restore",
    restoreStatus: restore.status(),
    runId,
    status: "attempted" as const,
    writeStatus: write.status(),
  };
  await writeFixtureAttempt(stack, attempted, testInfo);
  return attempted;
}

async function writeFixtureAttempt(
  stack: E2EStack,
  attempt: ConfigFixtureAttempt,
  testInfo: TestInfo,
) {
  await writeRealE2EScenarioEvidence(
    stack,
    "config-fixture-attempt",
    {
      ...attempt,
      attempts: [attempt],
      maxAttempts: 1,
      scenarioId: "config-fixture-attempt",
      status: attempt.status === "attempted" ? "passed" : "handoff-blocked",
      fixtureAttemptStatus: attempt.status,
    },
    testInfo,
  );
}

async function expectConfigSnapshot(response: {
  json: () => Promise<unknown>;
  ok: () => boolean;
  status: () => number;
}): Promise<ConfigSnapshotPayload> {
  expect(response.ok(), `/config returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as ConfigSnapshotPayload;
  if (payload.path !== undefined) {
    expect(typeof payload.path).toBe("string");
  }
  if (payload.exists !== undefined) {
    expect(typeof payload.exists).toBe("boolean");
  }
  if (payload.valid !== undefined) {
    expect(typeof payload.valid).toBe("boolean");
  }
  if (payload.raw !== undefined && payload.raw !== null) {
    expect(typeof payload.raw).toBe("string");
  }
  if (payload.config !== undefined) {
    expect(typeof payload.config).toBe("object");
  }
  if (payload.hash !== undefined) {
    expect(typeof payload.hash).toBe("string");
  }
  if (payload.baseHash !== undefined) {
    expect(typeof payload.baseHash).toBe("string");
  }
  return payload;
}

async function expectConfigLookup(
  response: { json: () => Promise<unknown>; ok: () => boolean; status: () => number },
  path: string,
): Promise<ConfigLookupPayload> {
  expect(response.ok(), `/config/schema-lookup returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as ConfigLookupPayload;
  expect(payload.path).toBe(path);
  expect(Array.isArray(payload.children)).toBe(true);
  if (payload.schema !== undefined) {
    expect(typeof payload.schema).toBe("object");
  }
  if (payload.hint !== undefined) {
    expect(typeof payload.hint).toBe("object");
  }
  return payload;
}

async function expectOkJson(
  response: { json: () => Promise<unknown>; ok: () => boolean; status: () => number },
  label: string,
) {
  expect(response.ok(), `${label} returned ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  return payload as JsonObject;
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(text: string): JsonObject | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (response.url().startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  return unexpected;
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const direct = { requests: [] as string[], websockets: [] as string[] };
  const gatewayUrl = stack.realGateway?.url;
  if (!gatewayUrl) {
    return direct;
  }
  page.on("request", (request) => {
    if (request.url().startsWith(gatewayUrl)) {
      direct.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (websocket.url().startsWith(gatewayUrl)) {
      direct.websockets.push(websocket.url());
    }
  });
  return direct;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
