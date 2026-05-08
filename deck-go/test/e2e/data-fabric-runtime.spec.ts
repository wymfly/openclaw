import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("Data Fabric runtime summary cache", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("keeps runtime summary cached across panel navigation", async ({ page }) => {
    const requests = trackRuntimeSummaryRequests(page);

    await openDeck(page, stack.frontendBase, "chat");
    await expect(
      page.getByRole("button", { name: /Connected|Reconnecting|Disconnected/ }),
    ).toBeVisible();
    await expect.poll(() => requests.length).toBe(2);

    await page.getByRole("button", { exact: true, name: "Agents" }).click();
    await expect(page.getByRole("banner").getByRole("heading", { name: "Agents" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Chat" }).click();
    await expect(page.getByRole("banner").getByRole("heading", { name: "Chat" })).toBeVisible();
    await page.waitForTimeout(500);

    expect(requests).toEqual(["/api/bootstrap/status", "/api/runtime/gateway"]);
  });
});

function trackRuntimeSummaryRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/bootstrap/status" || url.pathname === "/api/runtime/gateway") {
      requests.push(url.pathname);
    }
  });
  return requests;
}
