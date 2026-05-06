import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

const MEMORY_REAL_VARIANTS = [
  {
    browseTab: "Browse",
    cancelConfirm: "No",
    dreamsTab: "Dreams",
    healthTab: "Health",
    locale: "en" as const,
    navLabel: "Memory",
    rawHealth: "Raw health response",
    resetShortTermLabel: "Reset short-term",
    searchButton: "Search memory",
    searchPlaceholder: "search memory",
    searchTab: "Search",
    theme: "dark" as const,
    title: "Memory",
  },
  {
    browseTab: "浏览",
    cancelConfirm: "否",
    dreamsTab: "梦境",
    healthTab: "健康诊断",
    locale: "zh" as const,
    navLabel: "记忆",
    rawHealth: "原始健康响应",
    resetShortTermLabel: "重置短期",
    searchButton: "搜索记忆",
    searchPlaceholder: "搜索记忆",
    searchTab: "搜索",
    theme: "dark" as const,
    title: "记忆",
  },
  {
    browseTab: "Browse",
    cancelConfirm: "No",
    dreamsTab: "Dreams",
    healthTab: "Health",
    locale: "en" as const,
    navLabel: "Memory",
    rawHealth: "Raw health response",
    resetShortTermLabel: "Reset short-term",
    searchButton: "Search memory",
    searchPlaceholder: "search memory",
    searchTab: "Search",
    theme: "light" as const,
    title: "Memory",
  },
  {
    browseTab: "浏览",
    cancelConfirm: "否",
    dreamsTab: "梦境",
    healthTab: "健康诊断",
    locale: "zh" as const,
    navLabel: "记忆",
    rawHealth: "原始健康响应",
    resetShortTermLabel: "重置短期",
    searchButton: "搜索记忆",
    searchPlaceholder: "搜索记忆",
    searchTab: "搜索",
    theme: "light" as const,
    title: "记忆",
  },
];

test.describe("memory real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the memory real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(420_000);
    stack = await startRealGatewayStack(testInfo);
  }, 420_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies memory route shapes, isolated fixture, UI variants, and skipped-safe actions", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-memory-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const fixture = await createMemoryFixture(stack, runId);
    const routeEvidence: JsonObject = { fixture, runId };
    const uiEvidence: JsonObject[] = [];

    const runtime = await expectOkJson(
      await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers }),
      "/runtime/gateway",
    );
    routeEvidence.runtime = pickKeys(runtime, ["mode", "status", "health", "configured", "pid"]);

    const browse = await request.get(`${stack.backendBase}/api/memory/browse?agentId=main`, {
      headers,
    });
    routeEvidence.browseStatus = browse.status();
    let fixtureListed = false;
    if (browse.ok()) {
      const browsePayload = await jsonShape(browse);
      const files = Array.isArray(browsePayload.files) ? browsePayload.files : [];
      fixtureListed = files.some(
        (file) =>
          isObject(file) && file.name === fixture.fileName && file.path === fixture.fileName,
      );
      routeEvidence.browse = {
        fileCount: files.length,
        fixtureListed,
        keys: Object.keys(browsePayload),
      };
      if (fixtureListed) {
        const read = await request.get(
          `${stack.backendBase}/api/memory/browse?agentId=main&read=1&path=${encodeURIComponent(
            fixture.fileName,
          )}`,
          { headers },
        );
        expect(read.ok(), `/memory/browse read returned ${read.status()}`).toBe(true);
        const readPayload = await jsonShape(read);
        routeEvidence.read = {
          contentHasRunId:
            typeof readPayload.content === "string" && readPayload.content.includes(runId),
          keys: Object.keys(readPayload),
          path: readPayload.path ?? null,
          status: read.status(),
        };
        expect(routeEvidence.read).toMatchObject({ contentHasRunId: true });
      }
    } else {
      routeEvidence.browseDegraded = await browse.text();
      expect([400, 404, 503]).toContain(browse.status());
    }

    const postSearch = await request.post(`${stack.backendBase}/api/memory/search`, {
      data: { query: runId, scope: "all" },
      headers,
    });
    routeEvidence.postSearch = await routeShape(postSearch, [200, 501]);

    const legacySearch = await request.get(
      `${stack.backendBase}/api/memory/search?q=${encodeURIComponent(runId)}&scope=all`,
      { headers },
    );
    routeEvidence.legacySearch = await routeShape(legacySearch, [200, 501]);

    const health = await request.get(`${stack.backendBase}/api/memory/health`, { headers });
    expect(health.ok(), `/memory/health returned ${health.status()}`).toBe(true);
    const healthPayload = await jsonShape(health);
    routeEvidence.health = {
      entries: Array.isArray(healthPayload.entries) ? healthPayload.entries.length : null,
      keys: Object.keys(healthPayload),
      status: health.status(),
    };

    const dreamsRead = await request.post(`${stack.backendBase}/api/memory/dreams`, {
      data: { action: "read", agentId: "main" },
      headers,
    });
    routeEvidence.dreamsRead = await routeShape(dreamsRead, [200, 502]);
    routeEvidence.skippedSafe = {
      destructiveDreamActions:
        "reset/resetShortTerm/backfill/repair/dedupe not executed in real automation without disposable memory-root cleanup proof",
      directMemoryEditing: "not exposed by Memory panel",
      semanticSearch: "degraded until LanceDB adapter exists when route returns 501",
    };

    for (const variant of MEMORY_REAL_VARIANTS) {
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

        const memoryNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await memoryNav.scrollIntoViewIfNeeded();
        await memoryNav.click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "memory");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("memory-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByText(variant.title).first()).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.browseTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.searchTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.healthTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.dreamsTab })).toBeVisible();

        let readFixtureInUi = false;
        if (fixtureListed) {
          await expect(panel.getByText(fixture.fileName).first()).toBeVisible();
          await panel
            .getByRole("button", { name: new RegExp(escapeRegExp(fixture.fileName)) })
            .click();
          await expect(panel.getByText(runId).first()).toBeVisible();
          readFixtureInUi = true;
        } else {
          await expect(
            panel
              .getByText(/No memory files loaded|暂无记忆文件|failed to browse|浏览记忆失败/i)
              .first(),
          ).toBeVisible();
        }

        await panel.getByRole("tab", { name: variant.searchTab }).click();
        await panel.getByPlaceholder(variant.searchPlaceholder).fill(runId);
        await panel.getByRole("button", { name: variant.searchButton }).click();
        await expect(
          panel.getByText(/Not implemented|LanceDB|需要 LanceDB|暂无记忆搜索结果/).first(),
        ).toBeVisible();

        await panel.getByRole("tab", { name: variant.healthTab }).click();
        await expect(panel.getByText(variant.rawHealth)).toBeVisible();

        await panel.getByRole("tab", { name: variant.dreamsTab }).click();
        await expect(
          panel
            .getByText(
              /Dream Diary|梦境日记|No dream diary content|未返回梦境日记内容|memory dreams read failed|读取梦境日记失败/,
            )
            .first(),
        ).toBeVisible();
        await panel.getByRole("button", { name: variant.resetShortTermLabel }).click();
        await expect(panel.getByText(/Run memory dreams|运行记忆梦境/).first()).toBeVisible();
        await panel.getByRole("button", { name: variant.cancelConfirm, exact: true }).click();

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          fixtureListed,
          locale: variant.locale,
          navigation: "chat-to-memory",
          readFixtureInUi,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "memory-real-product-surface",
      {
        routeEvidence,
        runId,
        scenarioId: "memory.real.product-surface",
        status: fixtureListed ? "passed" : "degraded",
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function createMemoryFixture(stack: E2EStack, runId: string) {
  const fileName = `${buildRunScopedName(runId, "memory")}.md`;
  const workspace = path.join(stack.realE2E?.workspaceRoot ?? "", "main");
  if (!stack.realE2E?.workspaceRoot) {
    return { created: false, fileName, path: null, reason: "real E2E workspace root unavailable" };
  }
  await mkdir(workspace, { recursive: true });
  const filePath = path.join(workspace, fileName);
  await writeFile(
    filePath,
    [
      `# ${runId} memory fixture`,
      "",
      "This file is created inside the isolated deck-go real E2E workspace.",
      "It verifies browse/read without mutating the user's real memory store.",
      "",
    ].join("\n"),
    "utf8",
  );
  return { created: true, fileName, path: filePath };
}

async function routeShape(
  response: { json: () => Promise<unknown>; status: () => number; text: () => Promise<string> },
  allowedStatuses: number[],
) {
  expect(allowedStatuses, `unexpected status ${response.status()}`).toContain(response.status());
  try {
    const payload = await response.json();
    return {
      keys:
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? Object.keys(payload)
          : [],
      payload,
      status: response.status(),
    };
  } catch {
    return { status: response.status(), text: await response.text() };
  }
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

async function jsonShape(response: { json: () => Promise<unknown> }) {
  const payload = await response.json();
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  expect(Array.isArray(payload)).toBe(false);
  return payload as JsonObject;
}

function pickKeys(value: JsonObject, keys: string[]) {
  const picked: JsonObject = {};
  for (const key of keys) {
    if (key in value) {
      picked[key] = value[key];
    }
  }
  return picked;
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
    if (url.startsWith(`${backendBase}/api/memory/search`) && status === 501) {
      return;
    }
    if (url.startsWith(`${backendBase}/api/memory/browse`) && [400, 404, 503].includes(status)) {
      return;
    }
    if (url.startsWith(`${backendBase}/api/memory/dreams`) && status === 502) {
      return;
    }
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const direct = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      direct.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    const gatewayUrl = stack.realGateway?.url;
    const gatewayWebsocketUrl = gatewayUrl?.replace(/^http/i, "ws");
    if (
      (gatewayUrl && websocket.url().startsWith(gatewayUrl)) ||
      (gatewayWebsocketUrl && websocket.url().startsWith(gatewayWebsocketUrl))
    ) {
      direct.websockets.push(websocket.url());
    }
  });
  return direct;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
