import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import { gatewayUrl, isDashboardServerReachable, liveSmokeEnabled, resolveGatewayToken } from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck canvas", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("opens the canvas panel for a live session and shows the empty-state bridge surface", async ({
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

    const label = `PW Canvas ${Date.now()}`;
    const createResponse = await request.post("/api/chat/sessions/create", {
      data: {
        agentId: "main",
        label,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { key?: string };
    const sessionKey = created.key ?? "";
    expect(sessionKey).toBeTruthy();

    try {
      await gotoDashboard(page);
      await setActivePanel(page, "chat");

      await expect(page.getByPlaceholder("Search sessions...")).toBeVisible();
      await page.getByPlaceholder("Search sessions...").fill(label);
      const snapshotResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/chat/snapshot?sessionKey=${encodeURIComponent(sessionKey)}`) &&
          response.request().method() === "GET",
        { timeout: 15_000 },
      );
      await page.getByText(label, { exact: true }).click();
      const snapshotResponse = await snapshotResponsePromise;
      expect(snapshotResponse.ok()).toBeTruthy();

      const canvasFrameResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/canvas/index.html") &&
          response.request().method() === "GET",
        { timeout: 15_000 },
      );
      await page.locator('button[title="Canvas panel"]').click();
      const canvasFrameResponse = await canvasFrameResponsePromise;
      expect(canvasFrameResponse.ok()).toBeTruthy();

      await expect(page.getByText("Canvas", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("No canvas content", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTitle("A2UI Canvas")).toBeVisible();

      await page.locator('button[title="Collapse canvas"]').click();
      await expect(page.getByText("Canvas", { exact: true })).toBeHidden({ timeout: 15_000 });
    } finally {
      await request
        .delete("/api/chat/sessions", {
          data: {
            sessionKey,
          },
        })
        .catch(() => {});
    }
  });
});
