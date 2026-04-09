import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";

const liveSmokeEnabled = process.env.PLAYWRIGHT_LIVE_SMOKE === "1";
const gatewayUrl = process.env.PLAYWRIGHT_GATEWAY_URL ?? "ws://localhost:18789";

function resolveGatewayToken(): string | null {
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { auth?: { token?: string } };
    };
    const configToken = parsed.gateway?.auth?.token?.trim();
    return configToken || null;
  } catch {
    return null;
  }
}

const gatewayToken = resolveGatewayToken();

test.describe("Deck live smoke", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("boots against the local Gateway and loads key Deck panels", async ({ page, request }) => {
    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken: gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    await gotoDashboard(page);

    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("[data-chat-input]")).toBeVisible();

    await setActivePanel(page, "agents");
    await expect(page.getByRole("button", { name: /main/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await setActivePanel(page, "api-explorer");
    await expect(page.getByPlaceholder("Search methods...")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /agent\.|chat\.|sessions\./ }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
