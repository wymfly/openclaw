import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoDashboard, setEnglishLocale } from "./helpers";
import { gatewayUrl, isDashboardServerReachable, liveSmokeEnabled, resolveGatewayToken } from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck media", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("serves allowed local media paths for inline read and download", async ({ page, request }) => {
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

    const mediaDir = path.join(os.homedir(), ".openclaw", "media");
    await fs.mkdir(mediaDir, { recursive: true });
    const fileName = `pw-media-${Date.now()}.txt`;
    const filePath = path.join(mediaDir, fileName);
    const content = `Stage 1 media proof ${Date.now()}`;
    await fs.writeFile(filePath, content, "utf8");

    try {
      await gotoDashboard(page);

      const inlineResult = await page.evaluate(async (targetPath) => {
        const response = await fetch(`/api/media?path=${encodeURIComponent(targetPath)}`);
        return {
          status: response.status,
          contentType: response.headers.get("content-type"),
          disposition: response.headers.get("content-disposition"),
          body: await response.text(),
        };
      }, filePath);

      expect(inlineResult.status).toBe(200);
      expect(inlineResult.contentType).toContain("text/plain");
      expect(inlineResult.disposition).toBe("inline");
      expect(inlineResult.body).toBe(content);

      const downloadResult = await page.evaluate(async (targetPath) => {
        const response = await fetch(`/api/media?path=${encodeURIComponent(targetPath)}&dl=1`);
        return {
          status: response.status,
          disposition: response.headers.get("content-disposition"),
          body: await response.text(),
        };
      }, filePath);

      expect(downloadResult.status).toBe(200);
      expect(downloadResult.disposition).toContain(`attachment; filename="${fileName}"`);
      expect(downloadResult.body).toBe(content);
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  });
});
