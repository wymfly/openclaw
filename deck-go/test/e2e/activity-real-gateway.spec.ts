import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  seedRealGatewayChat,
  startRealGatewayStack,
  type E2EStack,
  writeRealE2EScenarioEvidence,
} from "./helpers";

test.describe("activity real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the activity real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;
  let seedStatus = "not-run";

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("seeds run-scoped activity data and verifies BFF read shapes", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";

    const seed = await seedRealGatewayChat(request, stack, testInfo, { maxAttempts: 2 });
    seedStatus = typeof seed.status === "string" ? seed.status : "degraded";

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
    await expect(runtime.json()).resolves.toMatchObject({ mode: "bundled" });

    const activity = await request.get(`${stack.backendBase}/api/activity`, {
      headers,
      params: { limit: "30" },
    });
    expect(activity.ok(), `/activity returned ${activity.status()}`).toBe(true);
    const activityPayload = (await activity.json()) as { events?: unknown };
    expect(Array.isArray(activityPayload.events)).toBe(true);

    await writeRealE2EScenarioEvidence(
      stack,
      "activity-real-bff-shape-and-seed",
      {
        scenarioId: "activity.real.bff-shape-and-seed",
        runId,
        status: seedStatus === "passed" ? "passed" : "degraded",
        maxAttempts: 2,
        attempts: Array.isArray(seed.attempts) ? seed.attempts : [],
        seedStatus,
        activityEventCount: Array.isArray(activityPayload.events)
          ? activityPayload.events.length
          : 0,
        endpoints: {
          "/api/runtime/gateway": runtime.status(),
          "/api/activity": activity.status(),
        },
      },
      testInfo,
    );
  });

  test("navigates to activity and exercises real UI variants", async ({ page }, testInfo) => {
    const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
    const unexpected = recordUnexpected(page, stack);

    for (const variant of [
      { locale: "en" as const, theme: "dark" as const, title: "Activity" },
      { locale: "zh" as const, theme: "light" as const, title: "动态" },
    ]) {
      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        locale: variant.locale,
        nav: "expanded",
        theme: variant.theme,
      });

      await page.getByRole("button", { name: /Activity|动态/ }).click();
      const panel = page.getByTestId("activity-panel");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
      await expect(
        panel.getByRole("button", {
          name: variant.locale === "en" ? /Refresh activity/ : /刷新动态/,
        }),
      ).toBeVisible();

      const search = panel.getByRole("searchbox");
      await expect(search).toBeVisible();
      await search.fill(runId);
      await panel
        .getByRole("tab", { name: variant.locale === "en" ? "All" : "全部" })
        .first()
        .click();

      const hasRunScopedEvent = await panel
        .getByText(runId)
        .first()
        .isVisible()
        .catch(() => false);
      if (!hasRunScopedEvent) {
        await search.fill("definitely-no-real-activity");
        await expect(
          panel.getByText(
            variant.locale === "en"
              ? /No activity events (match the current filters|were returned)/
              : /没有符合当前过滤条件的动态事件|未返回动态事件/,
          ),
        ).toBeVisible();
        await panel
          .getByRole("button", { name: variant.locale === "en" ? "Clear filters" : "清除过滤" })
          .click();
      } else {
        await panel.getByText(runId).first().click();
        await expect(
          page.getByRole("dialog", { name: variant.locale === "en" ? "Event detail" : "事件详情" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: variant.locale === "en" ? "Copy JSON" : "复制 JSON" })
          .click();
        await expect(
          page.getByRole("button", { name: variant.locale === "en" ? "Copied" : "已复制" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
          .last()
          .click();
      }

      await panel.getByRole("tab", { name: variant.locale === "en" ? /Errors/ : /错误/ }).click();
      await panel.getByRole("tab", { name: variant.locale === "en" ? /24h/ : /24 小时/ }).click();
      await panel
        .getByRole("button", { name: variant.locale === "en" ? /Refresh activity/ : /刷新动态/ })
        .click();
      await expect(panel).toBeVisible();
    }

    await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
    expect(unexpected.pageErrors).toEqual([]);
    expect(unexpected.consoleErrors).toEqual([]);
    expect(unexpected.directGatewayRequests).toEqual([]);
    expect(unexpected.directGatewaySockets).toEqual([]);

    await writeRealE2EScenarioEvidence(
      stack,
      "activity-real-ui-product-surface",
      {
        scenarioId: "activity.real.ui-product-surface",
        runId,
        status: "passed",
        seedStatus,
        attempts: [],
        variants: ["dark/en", "light/zh"],
        interactions: [
          "shell-nav",
          "search",
          "empty-recovery-or-dialog",
          "copy-json-when-seeded-row-visible",
          "severity-filter",
          "time-filter",
          "refresh",
        ],
        unexpected,
      },
      testInfo,
    );
  });
});

function recordUnexpected(page: Page, stack: E2EStack) {
  const unexpected = {
    apiErrors: [] as string[],
    consoleErrors: [] as string[],
    directGatewayRequests: [] as string[],
    directGatewaySockets: [] as string[],
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
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      unexpected.directGatewayRequests.push(request.url());
    }
    if (
      stack.realGateway?.url &&
      request.url().startsWith(stack.realGateway.url.replace("http", "ws"))
    ) {
      unexpected.directGatewaySockets.push(request.url());
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (response.url().startsWith(`${stack.backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${response.url()}`);
    }
  });
  return unexpected;
}
