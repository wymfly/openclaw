import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  createAlertRuleFixture,
  deleteAlertRuleFixture,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type AlertRuleFixture,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

test.describe("alerts real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the alerts real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  }, 300_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Alerts route shapes, fixture CRUD, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-alerts-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const fixtures: AlertRuleFixture[] = [];
    const routeEvidence: JsonObject = {
      attempts: [],
      runId,
    };
    const uiEvidence: JsonObject[] = [];

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
      routeEvidence.runtime = await jsonShape(runtime);

      const initial = await request.get(`${stack.backendBase}/api/alerts`, { headers });
      expect(initial.ok(), `/api/alerts returned ${initial.status()}`).toBe(true);
      const initialPayload = await jsonShape(initial);
      routeEvidence.initialList = {
        count: Array.isArray(initialPayload.rules) ? initialPayload.rules.length : 0,
        keys: Object.keys(initialPayload),
        status: initial.status(),
      };

      const fixture = await createAlertRuleFixture(request, stack, "alert-real", {
        action: "toast",
        condition: `${runId}_usage_pct > threshold`,
        enabled: true,
        entityType: "usage",
        threshold: 73,
      });
      fixtures.push(fixture);
      routeEvidence.created = fixture;

      const patched = await request.patch(
        `${stack.backendBase}/api/alerts/${encodeURIComponent(fixture.id)}`,
        {
          data: { action: "activity", enabled: false },
          headers,
        },
      );
      expect(patched.ok(), `/api/alerts patch returned ${patched.status()}`).toBe(true);
      const patchedPayload = await jsonShape(patched);
      expect(patchedPayload.rule).toMatchObject({
        action: "activity",
        enabled: false,
        id: fixture.id,
      });
      routeEvidence.patched = {
        keys: Object.keys(patchedPayload),
        status: patched.status(),
      };

      const invalid = await request.post(`${stack.backendBase}/api/alerts`, {
        data: {
          action: "email",
          condition: "usage_pct > threshold",
          entityType: "usage",
          name: `${fixture.name} invalid`,
          threshold: 90,
        },
        headers,
      });
      expect(invalid.status()).toBe(400);
      routeEvidence.invalidAction = {
        payload: await jsonShape(invalid),
        status: invalid.status(),
      };

      for (const variant of [
        {
          locale: "en" as const,
          theme: "dark" as const,
          navLabel: "Alerts",
          title: "Alert Management",
          actionLabel: "Activity",
          disabledLabel: "Disabled",
          conditionsLabel: "Conditions",
          firesLabel: "Recent fires",
          auditLabel: "Audit",
          testLabel: "Test fire",
          editLabel: "Edit Rule",
          deleteLabel: "Delete Rule",
          closeLabel: "Close",
          cancelLabel: "Cancel",
          backLabel: "Back to rules",
          firesFallback: /Fired alert history is not exposed by the Alerts contract/,
          auditFallback: /Audit history is not exposed by the Alerts contract/,
        },
        {
          locale: "zh" as const,
          theme: "dark" as const,
          navLabel: "告警",
          title: "告警管理",
          actionLabel: "活动",
          disabledLabel: "已禁用",
          conditionsLabel: "条件",
          firesLabel: "最近触发",
          auditLabel: "审计",
          testLabel: "测试触发",
          editLabel: "编辑规则",
          deleteLabel: "删除规则",
          closeLabel: "关闭",
          cancelLabel: "取消",
          backLabel: "返回规则列表",
          firesFallback: /Alerts 契约尚未暴露告警触发历史/,
          auditFallback: /Alerts 契约尚未暴露审计历史/,
        },
        {
          locale: "en" as const,
          theme: "light" as const,
          navLabel: "Alerts",
          title: "Alert Management",
          actionLabel: "Activity",
          disabledLabel: "Disabled",
          conditionsLabel: "Conditions",
          firesLabel: "Recent fires",
          auditLabel: "Audit",
          testLabel: "Test fire",
          editLabel: "Edit Rule",
          deleteLabel: "Delete Rule",
          closeLabel: "Close",
          cancelLabel: "Cancel",
          backLabel: "Back to rules",
          firesFallback: /Fired alert history is not exposed by the Alerts contract/,
          auditFallback: /Audit history is not exposed by the Alerts contract/,
        },
        {
          locale: "zh" as const,
          theme: "light" as const,
          navLabel: "告警",
          title: "告警管理",
          actionLabel: "活动",
          disabledLabel: "已禁用",
          conditionsLabel: "条件",
          firesLabel: "最近触发",
          auditLabel: "审计",
          testLabel: "测试触发",
          editLabel: "编辑规则",
          deleteLabel: "删除规则",
          closeLabel: "关闭",
          cancelLabel: "取消",
          backLabel: "返回规则列表",
          firesFallback: /Alerts 契约尚未暴露告警触发历史/,
          auditFallback: /Alerts 契约尚未暴露审计历史/,
        },
      ]) {
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

          const alertsNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await alertsNav.scrollIntoViewIfNeeded();
          await alertsNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "alerts",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("alerts-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();

          await panel.getByLabel("alert search").fill(runId);
          await expect(panel.getByText(fixture.name).first()).toBeVisible();
          await panel.getByRole("tab", { name: variant.actionLabel }).click();
          await panel.getByRole("tab", { name: variant.disabledLabel }).click();
          await panel.getByLabel("alert entity filter").selectOption("usage");
          await expect(panel.getByText(fixture.name).first()).toBeVisible();

          await panel.getByRole("button", { exact: true, name: fixture.name }).click();
          await expect(panel.getByRole("tab", { name: variant.conditionsLabel })).toBeVisible();
          await panel.getByRole("tab", { name: variant.conditionsLabel }).click();
          await expect(panel.getByText(`${runId}_usage_pct > threshold`).first()).toBeVisible();

          await panel.getByRole("tab", { name: variant.firesLabel }).click();
          await expect(panel.getByText(variant.firesFallback).first()).toBeVisible();

          await panel.getByRole("tab", { name: variant.auditLabel }).click();
          await expect(panel.getByText(variant.auditFallback).first()).toBeVisible();

          await panel.getByRole("button", { name: variant.testLabel }).click();
          await expect(page.getByRole("dialog", { name: variant.testLabel })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.testLabel })
            .getByRole("button", { name: variant.closeLabel })
            .click();

          await panel.getByRole("button", { name: variant.editLabel }).click();
          await expect(page.getByRole("dialog", { name: variant.editLabel })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.editLabel })
            .getByRole("button", { name: variant.cancelLabel })
            .first()
            .click();

          await panel.getByRole("button", { name: variant.deleteLabel }).click();
          await expect(page.getByRole("dialog", { name: variant.deleteLabel })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.deleteLabel })
            .getByRole("button", { name: variant.cancelLabel })
            .click();

          await panel.getByRole("button", { name: variant.backLabel }).click();
          await expect(panel.getByText(fixture.name).first()).toBeVisible();

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            filters: ["search", "action", "entity", "enabled"],
            fixture: fixture.name,
            locale: variant.locale,
            tabs: ["conditions", "fires", "audit"],
            theme: variant.theme,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      routeEvidence.cleanup = await cleanupAlertFixtures(request, stack, fixtures);
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "alerts-real-product-surface",
      {
        cleanup: routeEvidence.cleanup,
        routeEvidence,
        runId,
        scenarioId: "alerts.real.product-surface",
        status: "passed",
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function cleanupAlertFixtures(
  request: APIRequestContext,
  stack: E2EStack,
  fixtures: AlertRuleFixture[],
) {
  const cleanup: JsonObject[] = [];
  for (const fixture of fixtures) {
    await deleteAlertRuleFixture(request, stack, fixture);
    cleanup.push({ id: fixture.id, name: fixture.name, status: "deleted" });
  }
  return cleanup;
}

async function jsonShape(response: { json: () => Promise<unknown>; status: () => number }) {
  try {
    const payload = await response.json();
    return typeof payload === "object" && payload !== null
      ? (payload as JsonObject)
      : { value: payload };
  } catch {
    return { status: response.status() };
  }
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
