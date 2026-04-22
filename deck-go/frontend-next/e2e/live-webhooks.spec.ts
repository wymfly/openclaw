import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import { gatewayUrl, isDashboardServerReachable, liveSmokeEnabled, resolveGatewayToken } from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck webhooks", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("shows failed test deliveries in webhook history", async ({ page, request }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    const target = await new Promise<import("node:http").Server>((resolve) => {
      const server = createServer((_, res) => {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "receiver unavailable" }));
      });
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
    const address = target.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start webhook target server");
    }
    const targetUrl = `http://127.0.0.1:${address.port}/webhook`;

    const createResponse = await request.post("/api/webhooks", {
      data: {
        name: `PW Webhook ${Date.now()}`,
        url: targetUrl,
        events: ["approval.pending"],
        enabled: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id?: string; name?: string };
    const webhookId = created.id ?? "";
    const webhookName = created.name ?? "";
    expect(webhookId).toBeTruthy();
    expect(webhookName).toBeTruthy();

    try {
      await gotoDashboard(page);
      await setActivePanel(page, "webhooks");

      await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();

      const webhookButton = page.getByRole("button", { name: new RegExp(webhookName) }).first();
      await expect(webhookButton).toBeVisible({ timeout: 15_000 });
      await webhookButton.click();

      await expect(page.getByRole("heading", { name: "Delivery History" })).toBeVisible();

      const testResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/webhooks/${webhookId}/test`) &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: "Test Delivery" }).click();
      const testResponse = await testResponsePromise;
      expect(testResponse.ok()).toBeTruthy();

      const deliveriesResponse = await request.get(`/api/webhooks/${webhookId}/deliveries`);
      expect(deliveriesResponse.ok()).toBeTruthy();
      const deliveriesPayload = (await deliveriesResponse.json()) as {
        deliveries?: Array<{ success?: boolean; eventType?: string }>;
      };
      expect(deliveriesPayload.deliveries?.length).toBeGreaterThan(0);
      expect(deliveriesPayload.deliveries?.[0]?.success).toBe(false);
      expect(deliveriesPayload.deliveries?.[0]?.eventType).toBe("test.ping");

      await expect(page.getByText("test.ping", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Retrying", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Details:", { exact: false })).toBeVisible();
      await expect(page.getByText("receiver unavailable", { exact: false })).toBeVisible();
    } finally {
      await new Promise<void>((resolve) => target.close(() => resolve()));
      await request.delete(`/api/webhooks/${webhookId}`).catch(() => {});
    }
  });

  test("re-hydrates multiple failed delivery history entries after a full page reload", async ({
    page,
    request,
  }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    const target = await new Promise<import("node:http").Server>((resolve) => {
      const server = createServer((_, res) => {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "history survives reload" }));
      });
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
    const address = target.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start webhook target server");
    }
    const targetUrl = `http://127.0.0.1:${address.port}/webhook`;

    const createResponse = await request.post("/api/webhooks", {
      data: {
        name: `PW Webhook Reload ${Date.now()}`,
        url: targetUrl,
        events: ["approval.pending"],
        enabled: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id?: string; name?: string };
    const webhookId = created.id ?? "";
    const webhookName = created.name ?? "";
    expect(webhookId).toBeTruthy();
    expect(webhookName).toBeTruthy();

    try {
      await gotoDashboard(page);
      await setActivePanel(page, "webhooks");
      await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();

      const webhookButton = page.getByRole("button", { name: new RegExp(webhookName) }).first();
      await expect(webhookButton).toBeVisible({ timeout: 15_000 });
      await webhookButton.click();
      await expect(page.getByRole("heading", { name: "Delivery History" })).toBeVisible();

      const firstTestResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/webhooks/${webhookId}/test`) &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: "Test Delivery" }).click();
      const firstTestResponse = await firstTestResponsePromise;
      expect(firstTestResponse.ok()).toBeTruthy();

      await expect(page.getByText("history survives reload", { exact: false })).toHaveCount(1, {
        timeout: 15_000,
      });

      const secondTestResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/webhooks/${webhookId}/test`) &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: "Test Delivery" }).click();
      const secondTestResponse = await secondTestResponsePromise;
      expect(secondTestResponse.ok()).toBeTruthy();

      const deliveriesResponse = await request.get(`/api/webhooks/${webhookId}/deliveries`);
      expect(deliveriesResponse.ok()).toBeTruthy();
      const deliveriesPayload = (await deliveriesResponse.json()) as {
        deliveries?: Array<{ success?: boolean; eventType?: string }>;
      };
      expect(deliveriesPayload.deliveries?.length).toBeGreaterThanOrEqual(2);
      expect(
        deliveriesPayload.deliveries?.filter((delivery) => delivery.eventType === "test.ping")
          .length,
      ).toBeGreaterThanOrEqual(2);

      await page.reload();
      await setActivePanel(page, "webhooks");
      await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible({
        timeout: 15_000,
      });

      const reloadedWebhookButton = page
        .getByRole("button", { name: new RegExp(webhookName) })
        .first();
      await expect(reloadedWebhookButton).toBeVisible({ timeout: 15_000 });
      await reloadedWebhookButton.click();

      await expect(page.getByRole("heading", { name: "Delivery History" })).toBeVisible();
      await expect(page.getByText("test.ping", { exact: true })).toHaveCount(2, {
        timeout: 15_000,
      });
      await expect(page.getByText("Retrying", { exact: true })).toHaveCount(0);
      await expect(page.getByText("history survives reload", { exact: false })).toHaveCount(2, {
        timeout: 15_000,
      });
    } finally {
      await new Promise<void>((resolve) => target.close(() => resolve()));
      await request.delete(`/api/webhooks/${webhookId}`).catch(() => {});
    }
  });
});
