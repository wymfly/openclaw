import { expect, test } from "@playwright/test";
import {
  forcePanelError,
  gotoDashboard,
  setActivePanel,
  setEnglishLocale,
  stubDashboardShell,
} from "./helpers";

test.describe("Deck regression coverage", () => {
  test("chat sidebar prefers remote session preview and falls back silently on preview failure", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page, { streamStatus: 503 });

    await page.route("**/api/chat/sessions", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            key: "sess-1",
            agentId: "main",
            title: "Primary Session",
            updatedAt: Date.now(),
            lastMessagePreview: "fallback preview",
          },
        ]),
      }),
    );
    await page.route("**/api/chat/sessions/preview", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ts: Date.now(),
          previews: [
            {
              key: "sess-1",
              status: "ok",
              items: [{ role: "assistant", text: "remote preview" }],
            },
          ],
        }),
      }),
    );

    await gotoDashboard(page);
    await expect(page.getByText("remote preview")).toBeVisible();

    await page.unroute("**/api/chat/sessions/preview");
    await page.route("**/api/chat/sessions/preview", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "preview unavailable" }),
      }),
    );

    await page.reload();
    await expect(page.getByText("fallback preview")).toBeVisible();
  });

  test("chat keeps the disconnected banner visible and still sends a suggested prompt", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page, { streamStatus: 503 });

    await page.route("**/api/chat/sessions", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
    await page.route("**/api/chat/sessions/create", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ key: "sess-1" }),
      }),
    );
    await page.route("**/api/chat/session-events", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
    await page.route("**/api/chat/snapshot?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [],
          meta: {
            key: "sess-1",
            agentId: "main",
            updatedAt: Date.now(),
            status: "running",
          },
          activeApproval: null,
          a2uiState: null,
        }),
      }),
    );

    let sentMessage = "";
    await page.route("**/api/chat/send", async (route) => {
      const payload = route.request().postDataJSON() as { message?: string };
      sentMessage = payload.message ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "started" }),
      });
    });

    await gotoDashboard(page);

    await expect(page.getByText("Disconnected from server")).toBeVisible();
    await page.getByRole("button", { name: "Analyze performance issues in this code" }).click();
    await expect(page.locator("[data-chat-input]")).toHaveValue(
      "Analyze performance issues in this code",
    );

    await page.getByRole("button", { name: "Send" }).click();
    await expect(
      page.locator("main p").filter({ hasText: "Analyze performance issues in this code" }),
    ).toBeVisible();
    await expect.poll(() => sentMessage).toBe("Analyze performance issues in this code");
  });

  test("panel error boundary catches a forced panel crash and recovers on retry", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page);

    await gotoDashboard(page);
    await setActivePanel(page, "settings");
    await forcePanelError(page, "chat");
    await setActivePanel(page, "chat");

    await expect(page.getByTestId("panel-error-boundary")).toBeVisible();
    await expect(page.getByText("Something went wrong")).toBeVisible();

    await forcePanelError(page, null);
    await page.getByTestId("panel-error-retry").click();
    await expect(page.locator("[data-chat-input]")).toBeVisible();
  });

  test("agents compare renders field-level diffs for two mocked agents", async ({ page }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page);

    await page.route("**/api/agents", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          defaultId: "main",
          agents: [
            { id: "main", name: "Main Agent", model: "gpt-5.4", status: "idle" },
            { id: "reviewer", name: "Reviewer Agent", model: "gpt-5.4-mini", status: "busy" },
          ],
        }),
      }),
    );

    await page.route("**/api/deck/agents?agentId=main", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "main",
          name: "Main Agent",
          model: "gpt-5.4",
          tools: { allow: ["web", "shell"] },
          temperature: 0.2,
        }),
      }),
    );
    await page.route("**/api/deck/agents?agentId=reviewer", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "reviewer",
          name: "Reviewer Agent",
          model: "gpt-5.4-mini",
          tools: { allow: ["web"] },
          temperature: 0.8,
        }),
      }),
    );

    await gotoDashboard(page);
    await setActivePanel(page, "agents");

    await page.getByRole("button", { name: /Main Agent/i }).click();
    await page.getByRole("button", { name: "Compare" }).click();
    await page.getByLabel("Right Agent").selectOption("reviewer");

    await expect(page.getByText("Select Agents to Compare")).not.toBeVisible();
    await expect(page.getByText("temperature").first()).toBeVisible();
    await expect(page.getByText("model").first()).toBeVisible();
  });

  test("API explorer loads mocked methods and shows selected method details", async ({ page }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page);

    await page.route("**/api/gateway/describe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          methods: {
            "agent.detail": {
              scope: "operator.read",
              params: { type: "object", properties: { agentId: { type: "string" } } },
              result: { type: "object", properties: { id: { type: "string" } } },
              since: 1,
            },
            "chat.send": {
              scope: "chat.write",
              params: { type: "object", properties: { message: { type: "string" } } },
              result: { type: "object", properties: { ok: { type: "boolean" } } },
              since: 2,
            },
          },
          events: {
            "agent.updated": {
              payload: { type: "object", properties: { id: { type: "string" } } },
              since: 1,
            },
          },
          untyped: [],
        }),
      }),
    );

    await gotoDashboard(page);
    await setActivePanel(page, "api-explorer");

    await page.getByPlaceholder("Search methods...").fill("agent");
    await page.getByRole("button", { name: "agent.detail" }).click();

    await expect(page.getByText("operator.read")).toBeVisible();
    await expect(page.getByText("Parameters")).toBeVisible();
    await expect(page.getByRole("heading", { name: "agent.detail" })).toBeVisible();
  });

  test("channel test tool submits a mocked test message and renders delivery feedback", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page);

    await page.route("**/api/config/schema", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema: {
            properties: {
              channels: {
                properties: {
                  telegram: { type: "object" },
                },
              },
            },
          },
        }),
      }),
    );

    await page.route("**/api/channels", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channelOrder: ["telegram"],
          channelLabels: { telegram: "Telegram" },
          channels: { telegram: {} },
          channelAccounts: {
            telegram: {
              default: {
                accountId: "default",
                name: "Default",
                enabled: true,
                configured: true,
                linked: true,
                connected: true,
              },
            },
          },
          channelDefaultAccountId: { telegram: "default" },
        }),
      }),
    );

    let sentTestMessage = "";
    await page.route("**/api/channels/telegram/test", async (route) => {
      const payload = route.request().postDataJSON() as { message?: string };
      sentTestMessage = payload.message ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messageId: "msg-42" }),
      });
    });

    await gotoDashboard(page);
    await setActivePanel(page, "channels");

    await page.getByRole("button", { name: /Telegram/i }).click();
    await page.getByLabel("Test Message").fill("Deck channel smoke test");
    await page.getByRole("button", { name: "Send Test" }).click();

    await expect(page.getByText("Delivered (msg-42)")).toBeVisible();
    expect(sentTestMessage).toBe("Deck channel smoke test");
  });

  test("logs panel renders SSE log batches without polling", async ({ page }) => {
    await setEnglishLocale(page);
    await stubDashboardShell(page);

    await page.route("**/api/logs/stream", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          "id: 1",
          "event: log.batch",
          'data: {"lines":["2026-04-09T08:00:00Z [INFO] [gateway] Gateway ready"]}',
          "",
          "",
        ].join("\n"),
      }),
    );

    await gotoDashboard(page);
    await setActivePanel(page, "logs");

    await expect(page.getByText("Gateway ready")).toBeVisible();
  });
});
