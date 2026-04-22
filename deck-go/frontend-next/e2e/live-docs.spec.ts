import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  connectLiveGatewayClient,
  gatewayUrl,
  isDashboardServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck docs", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("extracts a live injected assistant transcript into Doc Hub", async ({ page, request }) => {
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

    const label = `PW Docs ${Date.now()}`;
    const title = `Playwright Extraction Spec ${Date.now()}`;
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

    const client = await connectLiveGatewayClient("playwright-docs-injector");

    try {
      const injected = await client.request("chat.inject", {
        sessionKey,
        label: "Injected transcript",
        message: `# ${title}

This specification captures a deterministic browser extraction flow for the Stage 1 host stack.
It documents API contract expectations, operator workflow checkpoints, regression boundaries,
acceptance notes, and troubleshooting details for docs extraction. The content is intentionally
long enough to satisfy extraction thresholds and includes terms like specification, API, contract,
workflow, guide, schema, and protocol so categorization remains stable during testing.`,
      });
      expect(injected.messageId).toBeTruthy();

      await gotoDashboard(page);
      await expect(page.getByPlaceholder("Search sessions...")).toBeVisible();
      await page.getByPlaceholder("Search sessions...").fill(label);
      await page.getByText(label, { exact: true }).click();

      await setActivePanel(page, "docs");
      await expect(page.getByRole("heading", { name: "Doc Hub" })).toBeVisible();
      await page.getByRole("button", { name: "Extract Docs" }).click();

      const searchInput = page.getByPlaceholder("Search docs...");
      await expect(searchInput).toBeVisible();
      await searchInput.fill(title);

      const docCard = page.locator("main button.text-left").filter({ hasText: title });
      await expect(docCard).toBeVisible({
        timeout: 15_000,
      });
      await docCard.click();
      await expect(page.locator("main h2").filter({ hasText: title }).first()).toBeVisible();

      await page.reload();
      await setActivePanel(page, "docs");
      await expect(page.getByRole("heading", { name: "Doc Hub" })).toBeVisible({
        timeout: 15_000,
      });

      const reloadedSearchInput = page.getByPlaceholder("Search docs...");
      await expect(reloadedSearchInput).toBeVisible();
      await reloadedSearchInput.fill(title);

      const reloadedDocCard = page.locator("main button.text-left").filter({ hasText: title });
      await expect(reloadedDocCard).toBeVisible({
        timeout: 15_000,
      });
      await reloadedDocCard.click();
      await expect(page.locator("main h2").filter({ hasText: title }).first()).toBeVisible();
    } finally {
      await client.stopAndWait({ timeoutMs: 2_000 }).catch(() => client.stop());
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
