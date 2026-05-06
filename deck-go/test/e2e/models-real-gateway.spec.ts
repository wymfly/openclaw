import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type ModelsConfigPayload = {
  config?: unknown;
  hash?: string;
  parsed?: unknown;
  raw?: string | null;
  sourceConfig?: unknown;
};
type ModelsFixture = {
  modelId: string;
  modelName: string;
  modelRef: string;
  originalRaw: string;
  providerId: string;
  runId: string;
};
type RpcEvidence = {
  body: string;
  method: string;
  ok: boolean;
  payload: JsonObject;
  status: number;
};

test.describe("models real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Models real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("creates run-scoped model data and verifies BFF/runtime contract shapes", async ({
    request,
  }, testInfo) => {
    const fixture = await createModelsFixture(request, stack, "models-api");

    try {
      const headers = authHeaders(stack.accessToken);
      const config = await getModelsConfig(request, stack);
      const raw = modelsConfigRaw(config);
      expect(raw).toContain(fixture.modelId);
      expect(raw).toContain(fixture.modelName);

      const runtimeModels = await rpcMaybe(request, stack, "models.configured", {});
      const modelEntries = runtimeModels.ok
        ? asArray(
            asRecord(runtimeModels.payload.result, "models.configured result").models ??
              asRecord(runtimeModels.payload.result, "models.configured result").items ??
              [],
            "models.configured models/items",
          )
        : [];

      const authOverview = await rpcMaybe(request, stack, "deck.auth.overview", {});
      const authProviders = authOverview.ok
        ? asArray(
            asRecord(authOverview.payload.result, "deck.auth.overview result").providers ?? [],
            "deck.auth.overview providers",
          )
        : [];

      const catalog = await rpcMaybe(request, stack, "models.catalog.providers", {});
      const catalogProviders = catalog.ok
        ? asArray(
            asRecord(catalog.payload.result, "models.catalog.providers result").providers ?? [],
            "models.catalog.providers providers",
          )
        : [];

      const usageCost = await expectOkJson(
        await request.get(`${stack.backendBase}/api/usage/cost?days=14`, { headers }),
        "/usage/cost",
      );
      expect(Array.isArray(usageCost.daily)).toBe(true);

      const usageProviders = await expectOkJson(
        await request.get(`${stack.backendBase}/api/usage/providers`, { headers }),
        "/usage/providers",
      );
      expect(Array.isArray(usageProviders.providers)).toBe(true);

      const legacyUsageCost = await expectOkJson(
        await request.get(`${stack.backendBase}/api/models/usage/cost?days=14`, { headers }),
        "/models/usage/cost",
      );
      expect(Array.isArray(legacyUsageCost.daily)).toBe(true);

      const legacyUsageProviders = await expectOkJson(
        await request.get(`${stack.backendBase}/api/models/usage/providers`, { headers }),
        "/models/usage/providers",
      );
      expect(Array.isArray(legacyUsageProviders.providers)).toBe(true);

      await writeRealE2EScenarioEvidence(
        stack,
        "models-api-fixture",
        {
          scenarioId: "models-api-fixture",
          runId: fixture.runId,
          status:
            runtimeModels.ok && authOverview.ok && catalog.ok ? "passed" : ("degraded" as const),
          fixture: {
            modelId: fixture.modelId,
            modelName: fixture.modelName,
            modelRef: fixture.modelRef,
            providerId: fixture.providerId,
          },
          runtimeModels: {
            count: modelEntries.length,
            status: runtimeModels.status,
          },
          authOverview: {
            count: authProviders.length,
            status: authOverview.status,
          },
          catalogProviders: {
            count: catalogProviders.length,
            status: catalog.status,
          },
          usageCostDays: (usageCost.daily as unknown[]).length,
          usageProviders: (usageProviders.providers as unknown[]).length,
          legacyUsageCostDays: (legacyUsageCost.daily as unknown[]).length,
          legacyUsageProviders: (legacyUsageProviders.providers as unknown[]).length,
          degradedRuntimeRpc: [runtimeModels, authOverview, catalog]
            .filter((entry) => !entry.ok)
            .map((entry) => ({ method: entry.method, status: entry.status, body: entry.body })),
          probe:
            "skipped-safe: avoids provider auth/network probe before the dedicated live-LLM pass",
        },
        testInfo,
      );
    } finally {
      await deleteModelsFixture(request, stack, fixture);
    }
  });

  test("renders Models UI variants through shell navigation with real fixture data", async ({
    browser,
    request,
  }, testInfo) => {
    const fixture = await createModelsFixture(request, stack, "models-ui");
    const variants = [
      {
        authDialog: /Configure auth - OpenAI/,
        catalogDialog: "Add model from catalog",
        configureAuth: "Configure auth",
        expectedTitle: "Models",
        locale: "en" as const,
        navLabel: "Models",
        searchLabel: "Search models",
        tabs: [
          ["Overview", "Runtime snapshot"],
          ["Limits", "Limits and capabilities"],
          ["Pricing", "Pricing and spend"],
          ["Usage", "Usage pressure"],
          ["Auth", "Auth configuration"],
          ["Audit", "Audit history"],
        ] as const,
        theme: "dark" as const,
      },
      {
        authDialog: /配置认证 - OpenAI/,
        catalogDialog: "从目录添加模型",
        configureAuth: "配置认证",
        expectedTitle: "模型",
        locale: "zh" as const,
        navLabel: "模型",
        searchLabel: "搜索模型",
        tabs: [
          ["概览", "运行时快照"],
          ["限制", "限制与能力"],
          ["价格", "价格与花费"],
          ["用量", "用量压力"],
          ["认证", "认证配置"],
          ["审计", "审计历史"],
        ] as const,
        theme: "light" as const,
      },
    ];

    try {
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
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "models",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("models-panel");
          await expect(panel.getByRole("heading", { name: variant.expectedTitle })).toBeVisible();
          await expect(panel.getByLabel(variant.searchLabel)).toBeVisible();
          await panel.getByLabel(variant.searchLabel).fill(fixture.modelId);
          await expect(panel.getByText(fixture.modelName).first()).toBeVisible();
          await panel.getByText(fixture.modelName).first().click();
          await expect(panel.getByRole("heading", { name: fixture.modelName })).toBeVisible();

          for (const [tab, heading] of variant.tabs) {
            await clickModelsDetailTab(panel, tab, heading);
          }

          await clickModelsDetailTab(
            panel,
            variant.locale === "en" ? "Auth" : "认证",
            variant.locale === "en" ? "Auth configuration" : "认证配置",
          );
          await panel.getByRole("button", { name: variant.configureAuth }).click();
          await expect(page.getByRole("dialog", { name: variant.authDialog })).toBeVisible();
          await page.getByRole("button", { name: "Close" }).click();
          await expect(page.getByRole("dialog", { name: variant.authDialog })).toBeHidden();

          await panel.getByRole("button", { name: variant.expectedTitle }).click();
          await expect(panel.getByText(fixture.modelName).first()).toBeVisible();
          await panel
            .getByRole("button", {
              name: variant.locale === "en" ? "Add from catalog" : "从目录添加",
            })
            .click();
          await expect(page.getByRole("dialog", { name: variant.catalogDialog })).toBeVisible();
          await page.getByRole("button", { name: "Close" }).click();

          await expect.poll(() => unexpected.slice()).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);
        } finally {
          await context.close();
        }
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "models-ui-variants",
        {
          scenarioId: "models-ui-variants",
          runId: fixture.runId,
          status: "passed",
          fixture: {
            modelId: fixture.modelId,
            modelName: fixture.modelName,
            modelRef: fixture.modelRef,
          },
          variants: variants.map((variant) => ({
            locale: variant.locale,
            theme: variant.theme,
            nav: "chat -> models",
            tabs: variant.tabs.map(([tab]) => tab),
          })),
          directBrowserGatewayCalls: "none",
        },
        testInfo,
      );
    } finally {
      await deleteModelsFixture(request, stack, fixture);
    }
  });
});

async function createModelsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
): Promise<ModelsFixture> {
  const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo-e2e", "models");
  const modelId = buildRunScopedName(runId, `${label}-model`);
  const modelName = buildRunScopedName(runId, `${label}-model-name`);
  const providerId = "openai";
  const modelRef = `${providerId}/${modelId}`;
  const fixtureModel = {
    contextWindow: 64_000,
    id: modelId,
    input: ["text"],
    maxTokens: 4096,
    name: modelName,
    reasoning: true,
  };
  assertRunScopedCleanupTarget(fixtureModel, runId);

  const config = await getModelsConfig(request, stack);
  const originalRaw = modelsConfigRaw(config) || "{}";
  const root = parseJsonObject(originalRaw);
  const models = cloneRecord(readRecord(root.models));
  const providers = cloneRecord(readRecord(models.providers));
  const provider = cloneRecord(readRecord(providers[providerId]));
  const existingModels = Array.isArray(provider.models) ? provider.models : [];
  provider.api = readString(provider.api) || "openai-responses";
  provider.auth = readString(provider.auth) || "api-key";
  provider.baseUrl = readString(provider.baseUrl) || "https://api.openai.com/v1";
  delete provider.apiKeyEnv;
  provider.models = [
    ...existingModels.filter((entry) => !isRunScopedModel(entry, runId)),
    fixtureModel,
  ];
  providers[providerId] = provider;
  models.providers = providers;
  root.models = models;

  await patchModelsConfig(
    request,
    stack,
    stringifyJson(root),
    config.hash,
    `deck-go real e2e ${label}`,
  );
  return { modelId, modelName, modelRef, originalRaw, providerId, runId };
}

async function deleteModelsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  fixture: ModelsFixture,
) {
  assertRunScopedCleanupTarget(
    { id: fixture.modelId, name: fixture.modelName, runId: fixture.runId },
    fixture.runId,
  );
  const config = await getModelsConfig(request, stack);
  const root = parseJsonObject(modelsConfigRaw(config) || fixture.originalRaw);
  const models = cloneRecord(readRecord(root.models));
  const providers = cloneRecord(readRecord(models.providers));
  const provider = cloneRecord(readRecord(providers[fixture.providerId]));
  provider.models = Array.isArray(provider.models)
    ? provider.models.filter((entry) => !isRunScopedModel(entry, fixture.runId))
    : [];
  providers[fixture.providerId] = provider;
  models.providers = providers;
  root.models = models;
  await patchModelsConfig(
    request,
    stack,
    stringifyJson(root),
    config.hash,
    "deck-go real e2e models fixture cleanup",
  );
}

async function getModelsConfig(request: APIRequestContext, stack: E2EStack) {
  return (await expectOkJson(
    await request.get(`${stack.backendBase}/api/models/config`, {
      headers: authHeaders(stack.accessToken),
    }),
    "/models/config",
  )) as ModelsConfigPayload;
}

async function patchModelsConfig(
  request: APIRequestContext,
  stack: E2EStack,
  raw: string,
  baseHash?: string,
  note?: string,
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await request.patch(`${stack.backendBase}/api/models/config`, {
      headers: authHeaders(stack.accessToken),
      data: { raw, baseHash, note },
    });
    const text = await response.text();
    if (response.ok()) {
      return parseJsonObject(text);
    }
    const retryAfterSeconds = parseRetryAfterSeconds(text);
    if (retryAfterSeconds !== null && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 1) * 1000));
      continue;
    }
    expect(response.ok(), `/models/config patch returned ${response.status()}: ${text}`).toBe(true);
    return parseJsonObject(text);
  }
  throw new Error("/models/config patch exhausted retry attempts");
}

async function rpcMaybe(
  request: APIRequestContext,
  stack: E2EStack,
  method: string,
  params: JsonObject,
): Promise<RpcEvidence> {
  const response = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
    headers: authHeaders(stack.accessToken),
    data: { method, params, timeoutMs: 5000 },
  });
  const status = response.status();
  const text = await response.text();
  const payload = parseJsonObject(text);
  if (!response.ok()) {
    expect([400, 404, 501, 502, 503], `${method} degraded with ${status}`).toContain(status);
    return { body: text.slice(0, 2000), method, ok: false, payload, status };
  }
  expect(payload.runtimeId).toBe("rt_local");
  return { body: text.slice(0, 2000), method, ok: true, payload, status };
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

function asRecord(value: unknown, label: string): JsonObject {
  expect(value, `${label} should be present`).toBeTruthy();
  expect(typeof value, `${label} should be an object`).toBe("object");
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as JsonObject;
}

function asArray(value: unknown, label: string) {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  return value as unknown[];
}

function parseJsonObject(text: string): JsonObject {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : { raw: parsed };
  } catch {
    return {};
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function readRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function modelsConfigRaw(config: ModelsConfigPayload) {
  if (typeof config.raw === "string" && config.raw.trim()) {
    return config.raw;
  }
  for (const candidate of [config.config, config.parsed, config.sourceConfig]) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return stringifyJson(candidate);
    }
  }
  return typeof config.raw === "string" ? config.raw : "";
}

function cloneRecord(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function parseRetryAfterSeconds(text: string) {
  const match = text.match(/retry after (\d+)s/i);
  return match ? Number(match[1]) : null;
}

function isRunScopedModel(value: unknown, runId: string) {
  if (typeof value === "string") {
    return value.includes(runId);
  }
  const record = readRecord(value);
  return [
    record.id,
    record.name,
    record.model,
    record.label,
    record.title,
    record.description,
  ].some((entry) => typeof entry === "string" && entry.includes(runId));
}

async function clickModelsDetailTab(panel: Locator, tab: string, heading: string) {
  const tabButton = panel.getByRole("tab", { name: tab });
  await tabButton.click();
  await expect(tabButton).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("heading", { name: heading })).toBeVisible();
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const requests: string[] = [];
  const websockets: string[] = [];
  const prefixes = directGatewayPrefixes(stack);
  page.on("request", (request) => {
    if (prefixes.some((prefix) => request.url().startsWith(prefix))) {
      requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (prefixes.some((prefix) => websocket.url().startsWith(prefix))) {
      websockets.push(websocket.url());
    }
  });
  return { requests, websockets };
}

function directGatewayPrefixes(stack: E2EStack) {
  if (!stack.realGateway?.url) {
    return [];
  }
  const url = new URL(stack.realGateway.url);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${wsProtocol}//${url.host}`];
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
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}
