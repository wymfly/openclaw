import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  createExecApprovalFixture,
  openDeck,
  resolveExecApprovalFixture,
  startRealGatewayStack,
  type E2EStack,
  type ExecApprovalFixture,
} from "./helpers";

type PendingPayload = { pending?: unknown[] } | unknown[];
type PluginPayload = { entries?: unknown[] } | unknown[];

test.describe("approvals real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Approvals real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    testInfo.setTimeout(420_000);
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies safe approval read route shapes", async ({ request }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const policy = await request.get(`${stack.backendBase}/api/approvals/policy`, { headers });
    const pending = await request.get(`${stack.backendBase}/api/approvals/pending`, { headers });
    const plugins = await request.get(`${stack.backendBase}/api/approvals/plugins`, { headers });

    const evidence: Record<string, unknown> = {
      policyCode: policy.status(),
      pendingCode: pending.status(),
      pluginsCode: plugins.status(),
    };

    if (policy.ok()) {
      const payload = (await policy.json()) as Record<string, unknown>;
      evidence.policyKeys = Object.keys(payload).toSorted();
      expect(typeof payload).toBe("object");
    } else {
      evidence.policyDegraded = await policy.text();
      expect([400, 404, 501, 502, 503]).toContain(policy.status());
    }

    if (pending.ok()) {
      const payload = (await pending.json()) as PendingPayload;
      const entries = Array.isArray(payload) ? payload : (payload.pending ?? []);
      evidence.pendingCount = entries.length;
      expect(Array.isArray(entries)).toBe(true);
    } else {
      evidence.pendingDegraded = await pending.text();
      expect([400, 404, 501, 502, 503]).toContain(pending.status());
    }

    if (plugins.ok()) {
      const payload = (await plugins.json()) as PluginPayload;
      const entries = Array.isArray(payload) ? payload : (payload.entries ?? []);
      evidence.pluginCount = entries.length;
      expect(Array.isArray(entries)).toBe(true);
    } else {
      evidence.pluginsDegraded = await plugins.text();
      expect([400, 404, 501, 502, 503]).toContain(plugins.status());
    }

    await testInfo.attach("approvals-real-contract-shape", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
  });

  test("navigates to Approvals and exercises variants with run-scoped real data", async ({
    page,
    request,
  }, testInfo) => {
    let fixture: ExecApprovalFixture | null = null;
    const unexpected = recordUnexpected(page, stack.backendBase);
    const directGatewayRequests: string[] = [];
    const directGatewaySockets: string[] = [];

    page.on("request", (request) => {
      if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
        directGatewayRequests.push(request.url());
      }
    });
    page.on("websocket", (websocket) => {
      if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
        directGatewaySockets.push(websocket.url());
      }
    });

    try {
      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        locale: "en",
        nav: "expanded",
        theme: "dark",
      });
      await page.getByRole("button", { name: "Approvals", exact: true }).click();

      const panel = page.getByTestId("approvals-panel");
      await expect(panel).toBeVisible();
      await expect(
        panel.getByRole("heading", { exact: true, name: "Approvals & Security" }),
      ).toBeVisible();
      await page.waitForTimeout(500);

      fixture = await createExecApprovalFixture(request, stack, "approvals-product-surface");
      await panel.getByRole("button", { name: "Refresh approvals" }).click();
      await expect(panel.getByText(fixture.command).first()).toBeVisible();
      await panel.getByRole("tab", { name: "Plan" }).click();
      await expect(panel.getByText("Decision scope").first()).toBeVisible();
      await panel.getByRole("tab", { name: "Argv" }).click();
      await expect(panel.getByText("Approval argv").first()).toBeVisible();
      await panel.getByRole("tab", { name: "Activity" }).click();
      await expect(panel.getByText("Recent decisions and summary KPIs").first()).toBeVisible();

      await testInfo.attach("approvals-real-dark-en", {
        body: await page.screenshot({ fullPage: false }),
        contentType: "image/png",
      });

      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        locale: "zh",
        nav: "expanded",
        theme: "light",
      });
      await page.getByRole("button", { name: "审批", exact: true }).click();
      const zhPanel = page.getByTestId("approvals-panel");
      await expect(zhPanel).toBeVisible();
      await expect(zhPanel.getByRole("heading", { name: "审批与安全", exact: true })).toBeVisible();
      await expect(zhPanel.getByText(fixture.command).first()).toBeVisible();
      await zhPanel.getByRole("tab", { name: "计划" }).click();
      await expect(zhPanel.getByText("决策范围").first()).toBeVisible();
      await zhPanel.getByRole("button", { name: "拒绝", exact: true }).click();
      await expect(zhPanel.getByText("最近审批操作").first()).toBeVisible();
      await expect(zhPanel.getByText("最近决策").first()).toBeVisible();

      await testInfo.attach("approvals-real-light-zh", {
        body: await page.screenshot({ fullPage: false }),
        contentType: "image/png",
      });

      await expect.poll(() => unexpected.slice()).toEqual([]);
      expect(directGatewayRequests).toEqual([]);
      expect(directGatewaySockets).toEqual([]);
      const resolvedFixture = fixture;
      await resolveExecApprovalFixture(request, stack, resolvedFixture, "deny", {
        allowMissing: true,
      });
      fixture = null;
      await testInfo.attach("approvals-real-fixture", {
        body: JSON.stringify(
          {
            status: "fixture-safe",
            fixtureClass: "exec approval",
            fixtureId: resolvedFixture.id,
            runId: stack.realE2E?.runId,
            notes:
              "Created a run-scoped exec approval through Gateway RPC and resolved it through the Deck BFF UI.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } finally {
      if (fixture) {
        await resolveExecApprovalFixture(request, stack, fixture, "deny", { allowMissing: true });
      }
    }
  });
});

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
    if (!url.startsWith(`${backendBase}/api/`) || status < 400) {
      return;
    }
    if (url.includes("/api/approvals") && [400, 404, 501, 502, 503].includes(status)) {
      return;
    }
    if (url.includes("/api/stream") && [400, 404, 501, 502, 503].includes(status)) {
      return;
    }
    unexpected.push(`response: ${status} ${url}`);
  });
  return unexpected;
}
