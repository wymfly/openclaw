import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
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
type PluginEntry = Record<string, unknown>;
type PluginPayload = {
  plugins?: PluginEntry[];
  scope?: string;
};
type PluginsFixtureAttempt = {
  status: "attempted" | "skipped-safe";
  method: string;
  runId: string;
  pluginId?: string;
  channelId?: string;
  providerId?: string;
  rootDir?: string;
  configPath?: string;
  reason?: string;
};

test.describe("plugins real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Plugins real Gateway E2E",
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

  test("attempts run-scoped plugin fixture data and verifies route shapes", async ({
    request,
  }, testInfo) => {
    const fixture = await createPluginFixtureAttempt(stack, "plugins-api", testInfo);

    try {
      const channelPayload = await fetchPluginsPayload(request, stack, "channel");
      const allPayload = await fetchPluginsPayload(request, stack, "all");
      const fixtureInChannel = findFixturePlugin(channelPayload.plugins ?? [], fixture);
      const fixtureInAll = findFixturePlugin(allPayload.plugins ?? [], fixture);
      const routeEvidenceStatus =
        fixture.status === "attempted" && !fixtureInAll ? "degraded" : "passed";

      await writeRealE2EScenarioEvidence(
        stack,
        "plugins-api-fixture",
        {
          scenarioId: "plugins-api-fixture",
          runId: fixture.runId,
          status: routeEvidenceStatus,
          fixture,
          routeShapes: {
            channelCount: channelPayload.plugins?.length ?? 0,
            channelScope: channelPayload.scope ?? null,
            allCount: allPayload.plugins?.length ?? 0,
            allScope: allPayload.scope ?? null,
          },
          fixtureVisible: {
            channel: Boolean(fixtureInChannel),
            all: Boolean(fixtureInAll),
          },
          degradedReason:
            routeEvidenceStatus === "degraded"
              ? "isolated openclaw.json + workspace plugin manifest fixture was written, but deck.plugins.list did not surface it in this Gateway run"
              : undefined,
        },
        testInfo,
      );
    } finally {
      await deletePluginFixtureAttempt(fixture);
    }
  });

  test("renders Plugins UI variants through shell navigation with real fixture evidence", async ({
    browser,
    request,
  }, testInfo) => {
    const fixture = await createPluginFixtureAttempt(stack, "plugins-ui", testInfo);
    const allPayload = await fetchPluginsPayload(request, stack, "all");
    const fixtureVisible = Boolean(findFixturePlugin(allPayload.plugins ?? [], fixture));
    const variants = [
      {
        backLabel: "Plugins",
        emptyFilteredTitle: "No plugins match this filter.",
        emptyText: "No plugins in this inventory scope",
        expectedTitle: "Plugins",
        locale: "en" as const,
        manifestButton: "Manifest",
        manifestDialog: "Manifest preview",
        navLabel: "Plugins",
        rawButton: "Raw",
        rawDialog: "Raw inventory entry",
        scopeAll: "scope=all",
        scopeChannel: "scope=channel",
        searchLabel: "Search",
        tabs: ["Overview", "Capabilities", "Diagnostics", "Activation", "Manifest", "Audit"],
        theme: "dark" as const,
      },
      {
        backLabel: "插件",
        emptyFilteredTitle: "没有匹配当前筛选的插件。",
        emptyText: "当前范围内没有插件",
        expectedTitle: "插件",
        locale: "zh" as const,
        manifestButton: "Manifest",
        manifestDialog: "Manifest 预览",
        navLabel: "插件",
        rawButton: "原始数据",
        rawDialog: "原始清单条目",
        scopeAll: "scope=all",
        scopeChannel: "scope=channel",
        searchLabel: "搜索",
        tabs: ["概览", "能力", "诊断", "激活", "Manifest", "审计"],
        theme: "light" as const,
      },
    ];
    const variantEvidence: JsonObject[] = [];

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
            "plugins",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("plugins-panel");
          await expect(panel.getByRole("heading", { name: variant.expectedTitle })).toBeVisible();
          await expect(panel.getByLabel(variant.searchLabel)).toBeVisible();
          await panel.getByRole("tab", { name: variant.scopeAll }).click();
          await expect(panel.getByRole("tab", { name: variant.scopeAll })).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await waitForPluginListSettled(panel, {
            emptyFilteredTitle: variant.emptyFilteredTitle,
            emptyText: variant.emptyText,
          });

          if (fixtureVisible && fixture.pluginId) {
            await panel.getByLabel(variant.searchLabel).fill(fixture.pluginId);
            await waitForPluginListSettled(panel, {
              emptyFilteredTitle: variant.emptyFilteredTitle,
              emptyText: variant.emptyText,
            });
            await expect(panel.getByText(fixture.pluginId).first()).toBeVisible();
          }

          const rowCount = await panel.locator(".row").count();
          if (rowCount > 0) {
            const row =
              fixtureVisible && fixture.pluginId
                ? panel.getByRole("button", { name: new RegExp(escapeRegExp(fixture.pluginId)) })
                : panel.locator(".row");
            await row.first().click();
            await expect(panel.getByRole("button", { name: variant.backLabel })).toBeVisible();

            for (const tab of variant.tabs) {
              const tabButton = panel.getByRole("tab", { name: tab });
              await tabButton.click();
              await expect(tabButton).toHaveAttribute("aria-selected", "true");
            }

            await panel.getByRole("button", { name: variant.manifestButton }).first().click();
            await expect(page.getByRole("dialog", { name: variant.manifestDialog })).toBeVisible();
            await page
              .getByRole("dialog", { name: variant.manifestDialog })
              .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
              .last()
              .click();
            await expect(page.getByRole("dialog", { name: variant.manifestDialog })).toBeHidden();

            await panel.getByRole("button", { name: variant.rawButton }).first().click();
            await expect(page.getByRole("dialog", { name: variant.rawDialog })).toBeVisible();
            await page
              .getByRole("dialog", { name: variant.rawDialog })
              .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
              .last()
              .click();
            await expect(page.getByRole("dialog", { name: variant.rawDialog })).toBeHidden();

            await panel.getByRole("button", { name: variant.backLabel }).click();
            await expect(panel.getByRole("tab", { name: variant.scopeAll })).toBeVisible();
            await panel.getByRole("tab", { name: variant.scopeChannel }).click();
            await expect(panel.getByRole("tab", { name: variant.scopeChannel })).toHaveAttribute(
              "aria-selected",
              "true",
            );
          } else {
            await expect(
              panel.getByText(variant.emptyText).or(panel.getByText(variant.emptyFilteredTitle)),
            ).toBeVisible();
          }

          await expect.poll(() => unexpected.slice()).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          variantEvidence.push({
            locale: variant.locale,
            theme: variant.theme,
            nav: "chat -> plugins",
            rowCount,
            fixtureVisible,
            interactions:
              rowCount > 0
                ? ["scope=all", "detail tabs", "manifest dialog", "raw dialog", "scope=channel"]
                : ["scope=all", "empty-valid fallback"],
            directBrowserGatewayCalls: "none",
          });
        } finally {
          await context.close();
        }
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "plugins-ui-variants",
        {
          scenarioId: "plugins-ui-variants",
          runId: fixture.runId,
          status: fixture.status === "attempted" && !fixtureVisible ? "degraded" : "passed",
          fixture,
          fixtureVisible,
          variants: variantEvidence,
          degradedReason:
            fixture.status === "attempted" && !fixtureVisible
              ? "safe fixture attempt did not surface in real plugin inventory; UI variants still exercised populated or empty-valid real Gateway state"
              : undefined,
        },
        testInfo,
      );
    } finally {
      await deletePluginFixtureAttempt(fixture);
    }
  });
});

async function createPluginFixtureAttempt(
  stack: E2EStack,
  label: string,
  testInfo: TestInfo,
): Promise<PluginsFixtureAttempt> {
  const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo-e2e", "plugins");
  const isolation = stack.realE2E;
  if (!isolation) {
    const skipped = {
      status: "skipped-safe" as const,
      method: "isolated openclaw.json + workspace plugin manifest",
      runId,
      reason: "real E2E isolation metadata is unavailable",
    };
    await writeFixtureAttemptEvidence(stack, skipped, testInfo);
    return skipped;
  }

  const pluginId = buildRunScopedName(runId, `${label}-plugin`);
  const channelId = buildRunScopedName(runId, `${label}-channel`);
  const providerId = buildRunScopedName(runId, `${label}-provider`);
  const toolName = buildRunScopedName(runId, `${label}-tool`);
  const rootDir = path.join(isolation.workspaceRoot, "main", "plugins", pluginId);
  assertRunScopedCleanupTarget(pluginId, runId);
  assertRunScopedCleanupTarget(channelId, runId);
  assertRunScopedCleanupTarget(providerId, runId);
  assertRunScopedCleanupTarget(toolName, runId);
  assertRunScopedCleanupTarget(rootDir, runId);
  assertIsolatedConfigPath(isolation.configPath, isolation.root);

  const attempt: PluginsFixtureAttempt = {
    status: "attempted",
    method: "isolated openclaw.json + workspace plugin manifest",
    runId,
    pluginId,
    channelId,
    providerId,
    rootDir,
    configPath: isolation.configPath,
  };

  try {
    await mkdir(rootDir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(rootDir, "index.cjs"), "module.exports = { register() {} };\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await writeFile(
      path.join(rootDir, "openclaw.plugin.json"),
      `${JSON.stringify(
        {
          id: pluginId,
          name: `Deck Go E2E Plugin ${runId}`,
          version: "0.0.1",
          configSchema: {
            type: "object",
            additionalProperties: true,
          },
          channels: [channelId],
          providers: [providerId],
          contracts: {
            tools: [toolName],
          },
          deck: {
            actionCapabilities: {
              login: false,
              probe: true,
              testMessage: false,
              qrCodeAuth: false,
            },
          },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await patchIsolatedOpenClawConfigForPluginFixture(isolation.configPath, {
      pluginId,
      rootDir,
      runId,
    });
    await writeFixtureAttemptEvidence(stack, attempt, testInfo);
    return attempt;
  } catch (error) {
    const skipped = {
      ...attempt,
      status: "skipped-safe" as const,
      reason: error instanceof Error ? error.message : String(error),
    };
    await writeFixtureAttemptEvidence(stack, skipped, testInfo);
    return skipped;
  }
}

async function deletePluginFixtureAttempt(attempt: PluginsFixtureAttempt) {
  if (attempt.status !== "attempted") {
    return;
  }
  if (attempt.rootDir) {
    assertRunScopedCleanupTarget(attempt.rootDir, attempt.runId);
    await rm(attempt.rootDir, { recursive: true, force: true });
  }
  if (attempt.configPath && attempt.pluginId) {
    assertRunScopedCleanupTarget(attempt.pluginId, attempt.runId);
    await removePluginFixtureFromIsolatedConfig(attempt.configPath, attempt);
  }
}

async function patchIsolatedOpenClawConfigForPluginFixture(
  configPath: string,
  fixture: { pluginId: string; rootDir: string; runId: string },
) {
  const config = await readJsonObjectFile(configPath);
  const plugins = ensureObject(config, "plugins");
  const load = ensureObject(plugins, "load");
  const paths = asStringArray(load.paths);
  if (!paths.includes(fixture.rootDir)) {
    paths.push(fixture.rootDir);
  }
  load.paths = paths;
  const entries = ensureObject(plugins, "entries");
  entries[fixture.pluginId] = {
    enabled: true,
    config: {
      deckGoE2ERunId: fixture.runId,
    },
  };
  await writeJsonObjectFile(configPath, config);
}

async function removePluginFixtureFromIsolatedConfig(
  configPath: string,
  fixture: PluginsFixtureAttempt,
) {
  const config = await readJsonObjectFile(configPath);
  const plugins = readObject(config.plugins);
  if (!plugins) {
    return;
  }
  const load = readObject(plugins.load);
  if (load) {
    load.paths = asStringArray(load.paths).filter((entry) => {
      if (entry === fixture.rootDir || entry.includes(fixture.runId)) {
        assertRunScopedCleanupTarget(entry, fixture.runId);
        return false;
      }
      return true;
    });
  }
  const entries = readObject(plugins.entries);
  if (entries && fixture.pluginId) {
    delete entries[fixture.pluginId];
  }
  await writeJsonObjectFile(configPath, config);
}

async function fetchPluginsPayload(
  request: APIRequestContext,
  stack: E2EStack,
  scope: "channel" | "all",
) {
  const endpoint =
    scope === "all"
      ? `${stack.backendBase}/api/deck/plugins?capability=all`
      : `${stack.backendBase}/api/deck/plugins`;
  const response = await request.get(endpoint, { headers: authHeaders(stack.accessToken) });
  expect(response.ok(), `${endpoint} returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as PluginPayload;
  expect(Array.isArray(payload.plugins), `${endpoint} should return plugins[]`).toBe(true);
  return payload;
}

function findFixturePlugin(plugins: PluginEntry[], fixture: PluginsFixtureAttempt) {
  if (fixture.status !== "attempted" || !fixture.pluginId) {
    return undefined;
  }
  return plugins.find((plugin) => pluginMatchesFixture(plugin, fixture));
}

function pluginMatchesFixture(plugin: PluginEntry, fixture: PluginsFixtureAttempt) {
  const values = [
    plugin.id,
    plugin.name,
    ...(Array.isArray(plugin.channelIds) ? plugin.channelIds : []),
    ...(Array.isArray(plugin.providerIds) ? plugin.providerIds : []),
    ...(Array.isArray(plugin.toolNames) ? plugin.toolNames : []),
  ];
  return values.some(
    (value) =>
      typeof value === "string" &&
      (value.includes(fixture.pluginId ?? "") ||
        value.includes(fixture.channelId ?? "") ||
        value.includes(fixture.providerId ?? "") ||
        value.includes(fixture.runId)),
  );
}

async function writeFixtureAttemptEvidence(
  stack: E2EStack,
  attempt: PluginsFixtureAttempt,
  testInfo: TestInfo,
) {
  await writeRealE2EScenarioEvidence(
    stack,
    "plugins-fixture-attempt",
    {
      scenarioId: "plugins-fixture-attempt",
      ...attempt,
      status: attempt.status === "skipped-safe" ? "skipped-safe" : "passed",
      fixtureAttemptStatus: attempt.status,
      statusLabel: attempt.status,
    },
    testInfo,
  );
}

async function waitForPluginListSettled(
  panel: ReturnType<Page["getByTestId"]>,
  emptyState: { emptyFilteredTitle: string; emptyText: string },
) {
  await expect
    .poll(async () => {
      const loading = await panel.locator(".list-state--loading").count();
      if (loading > 0) {
        return false;
      }
      const rows = await panel.locator(".row").count();
      const empty = await panel.getByText(emptyState.emptyText).count();
      const filtered = await panel.getByText(emptyState.emptyFilteredTitle).count();
      return rows > 0 || empty > 0 || filtered > 0;
    })
    .toBe(true);
}

async function readJsonObjectFile(filePath: string) {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isObject(parsed)) {
    throw new Error(`expected JSON object at ${filePath}`);
  }
  return parsed;
}

async function writeJsonObjectFile(filePath: string, value: JsonObject) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (isObject(current)) {
    return current;
  }
  const next: JsonObject = {};
  parent[key] = next;
  return next;
}

function readObject(value: unknown): JsonObject | undefined {
  return isObject(value) ? value : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function assertIsolatedConfigPath(configPath: string, isolationRoot: string) {
  const relative = path.relative(isolationRoot, configPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`refusing to mutate non-isolated OpenClaw config path: ${configPath}`);
  }
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
