import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  createBudgetRuleFixture,
  deleteBudgetRuleFixture,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type BudgetRuleFixture,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

test.describe("budget real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the budget real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(300_000);
    stack = await startRealGatewayStack(testInfo);
  }, 300_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Budget route shapes, fixture CRUD, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-budget-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const fixtures: BudgetRuleFixture[] = [];
    const routeEvidence: JsonObject = { attempts: [], runId };
    const uiEvidence: JsonObject[] = [];

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
      routeEvidence.runtime = await jsonShape(runtime);

      const initial = await request.get(`${stack.backendBase}/api/usage/budget`, { headers });
      expect(initial.ok(), `/usage/budget returned ${initial.status()}`).toBe(true);
      const initialPayload = await jsonShape(initial);
      routeEvidence.initialList = {
        count: Array.isArray(initialPayload.rules) ? initialPayload.rules.length : 0,
        keys: Object.keys(initialPayload),
        status: initial.status(),
      };

      const activeFixture = await createBudgetRuleFixture(request, stack, "budget-real-active", {
        dimension: "cost",
        enabled: true,
        overThreshold: 240,
        period: "monthly",
        scope: "global",
        warnThreshold: 120,
      });
      const disabledFixture = await createBudgetRuleFixture(
        request,
        stack,
        "budget-real-disabled",
        {
          dimension: "totalTokens",
          enabled: false,
          overThreshold: 260000,
          period: "weekly",
          scope: "global",
          warnThreshold: 130000,
        },
      );
      fixtures.push(activeFixture, disabledFixture);
      routeEvidence.created = { activeFixture, disabledFixture };

      const patched = await request.patch(
        `${stack.backendBase}/api/usage/budget/${encodeURIComponent(activeFixture.id)}`,
        {
          data: { enabled: true, warnThreshold: 130, overThreshold: 260 },
          headers,
        },
      );
      expect(patched.ok(), `/usage/budget patch returned ${patched.status()}`).toBe(true);
      const patchedPayload = await jsonShape(patched);
      expect(patchedPayload).toMatchObject({
        enabled: true,
        id: activeFixture.id,
        warnThreshold: 130,
        overThreshold: 260,
      });
      routeEvidence.patched = {
        keys: Object.keys(patchedPayload),
        status: patched.status(),
      };

      const invalid = await request.post(`${stack.backendBase}/api/usage/budget`, {
        data: {
          dimension: "cost",
          enabled: false,
          name: `${activeFixture.name} invalid`,
          overThreshold: 10,
          period: "monthly",
          scope: "global",
          warnThreshold: 20,
        },
        headers,
      });
      expect(invalid.status()).toBe(400);
      routeEvidence.invalidThreshold = {
        payload: await jsonShape(invalid),
        status: invalid.status(),
      };

      const evaluated = await request.get(`${stack.backendBase}/api/usage/budget/evaluate`, {
        headers,
      });
      expect(evaluated.ok(), `/usage/budget/evaluate returned ${evaluated.status()}`).toBe(true);
      const evaluatedPayload = await jsonShape(evaluated);
      routeEvidence.evaluated = {
        count: Array.isArray(evaluatedPayload.evaluations)
          ? evaluatedPayload.evaluations.length
          : 0,
        keys: Object.keys(evaluatedPayload),
        status: evaluated.status(),
      };

      for (const variant of [
        {
          locale: "en" as const,
          theme: "dark" as const,
          navLabel: "Budget",
          title: "Budget",
          disabledFilter: "Disabled",
          editLabel: "Edit",
          toggleLabel: "Disable rule",
          deleteLabel: "Delete",
          createLabel: "Create",
          addLabel: "New Rule",
          saveLabel: "Save",
          cancelLabel: "Cancel",
          closeLabel: "Close",
          validationLabel: "Rule name is required",
          definitionLabel: "Definition",
          recentFallback: /No durable recent changes are exposed by the Budget contract/,
        },
        {
          locale: "zh" as const,
          theme: "dark" as const,
          navLabel: "预算",
          title: "预算管理",
          disabledFilter: "禁用",
          editLabel: "编辑",
          toggleLabel: "禁用规则",
          deleteLabel: "删除",
          createLabel: "创建",
          addLabel: "新建规则",
          saveLabel: "保存",
          cancelLabel: "取消",
          closeLabel: "关闭",
          validationLabel: "必须填写规则名称",
          definitionLabel: "规则定义",
          recentFallback: /Budget 契约尚未暴露持久最近变更/,
        },
        {
          locale: "en" as const,
          theme: "light" as const,
          navLabel: "Budget",
          title: "Budget",
          disabledFilter: "Disabled",
          editLabel: "Edit",
          toggleLabel: "Disable rule",
          deleteLabel: "Delete",
          createLabel: "Create",
          addLabel: "New Rule",
          saveLabel: "Save",
          cancelLabel: "Cancel",
          closeLabel: "Close",
          validationLabel: "Rule name is required",
          definitionLabel: "Definition",
          recentFallback: /No durable recent changes are exposed by the Budget contract/,
        },
        {
          locale: "zh" as const,
          theme: "light" as const,
          navLabel: "预算",
          title: "预算管理",
          disabledFilter: "禁用",
          editLabel: "编辑",
          toggleLabel: "禁用规则",
          deleteLabel: "删除",
          createLabel: "创建",
          addLabel: "新建规则",
          saveLabel: "保存",
          cancelLabel: "取消",
          closeLabel: "关闭",
          validationLabel: "必须填写规则名称",
          definitionLabel: "规则定义",
          recentFallback: /Budget 契约尚未暴露持久最近变更/,
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

          const budgetNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await budgetNav.scrollIntoViewIfNeeded();
          await budgetNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "budget",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("budget-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();

          await panel.getByLabel("budget rule search").fill(runId);
          await expect(panel.getByText(activeFixture.name).first()).toBeVisible();
          await panel.getByRole("tab", { name: new RegExp(variant.disabledFilter) }).click();
          await expect(panel.getByText(disabledFixture.name).first()).toBeVisible();
          await panel.getByRole("tab", { name: /All|全部/ }).click();
          await expect(panel.getByText(activeFixture.name).first()).toBeVisible();

          await panel.getByRole("button", { name: new RegExp(activeFixture.name) }).click();
          await expect(panel.getByText(variant.definitionLabel).first()).toBeVisible();
          await expect(panel.getByText(variant.recentFallback).first()).toBeVisible();

          await panel.getByRole("button", { name: variant.editLabel }).click();
          await expect(
            page.getByRole("dialog", {
              name: variant.editLabel === "Edit" ? "Edit Rule" : "编辑规则",
            }),
          ).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.editLabel === "Edit" ? "Edit Rule" : "编辑规则" })
            .getByRole("button", { name: variant.cancelLabel })
            .click();

          await panel.getByRole("button", { name: variant.toggleLabel }).click();
          await expect(page.getByRole("dialog", { name: variant.toggleLabel })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.toggleLabel })
            .getByRole("button", { name: variant.cancelLabel })
            .click();

          await panel.getByRole("button", { name: variant.deleteLabel }).click();
          await expect(
            page.getByRole("dialog", {
              name: variant.deleteLabel === "Delete" ? "Delete Rule" : "删除规则",
            }),
          ).toBeVisible();
          await page
            .getByRole("dialog", {
              name: variant.deleteLabel === "Delete" ? "Delete Rule" : "删除规则",
            })
            .getByRole("button", { name: variant.cancelLabel })
            .click();

          await panel.getByRole("button", { name: variant.createLabel }).click();
          await expect(page.getByRole("dialog", { name: variant.addLabel })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.addLabel })
            .getByRole("button", { name: variant.saveLabel })
            .click();
          await expect(page.getByText(variant.validationLabel).first()).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.addLabel })
            .getByRole("button", { name: variant.closeLabel })
            .click();

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            fixture: activeFixture.name,
            filters: ["search", "disabled"],
            locale: variant.locale,
            surfaces: ["definition", "recentChangesFallback", "edit", "toggle", "delete", "create"],
            theme: variant.theme,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      routeEvidence.cleanup = await cleanupBudgetFixtures(request, stack, fixtures);
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "budget-real-product-surface",
      {
        cleanup: routeEvidence.cleanup,
        routeEvidence,
        runId,
        scenarioId: "budget.real.product-surface",
        status: "passed",
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function cleanupBudgetFixtures(
  request: Parameters<typeof deleteBudgetRuleFixture>[0],
  stack: E2EStack,
  fixtures: BudgetRuleFixture[],
) {
  const cleanup: JsonObject[] = [];
  for (const fixture of fixtures) {
    await deleteBudgetRuleFixture(request, stack, fixture);
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
