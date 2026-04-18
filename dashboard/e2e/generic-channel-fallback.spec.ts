import { expect, test } from "@playwright/test";
import { buildMockChannel, buildMockChannelAccount, buildMockPlugin } from "./channel-fixtures";
import { gotoDashboard, setActivePanel, setEnglishLocale, stubChannelWorkspace } from "./helpers";

const telegramChannel = buildMockChannel({
  id: "telegram",
  label: "Telegram Ops",
  detailLabel: "Telegram Operations",
  pluginId: "telegram",
  pluginOrigin: "bundled",
  pluginConfigPath: "plugins.entries.telegram.config",
  defaultAccountId: "bot-main",
  accounts: [
    buildMockChannelAccount({
      accountId: "bot-main",
      name: "Main Bot",
      connected: true,
      probe: { ok: true, latencyMs: 31 },
    }),
  ],
});

const telegramPlugin = buildMockPlugin({
  id: "telegram",
  name: "Telegram Plugin",
  channelIds: ["telegram"],
});

test.describe("@mock generic channel fallback", () => {
  test("keeps a generic channel on the standard detail shell without WeCom-specific navigation", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubChannelWorkspace(page, {
      channels: [telegramChannel],
      plugins: [telegramPlugin],
      gatewayStatus: "connected",
      config: {
        channels: {
          telegram: {},
        },
      },
    });

    await gotoDashboard(page);
    await setActivePanel(page, "channels");
    await page.getByRole("button", { name: /Telegram Ops/i }).click();

    await expect(page.getByRole("heading", { name: "Telegram Ops" })).toBeVisible();
    await expect(page.getByTestId("wecom-shell-nav")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Login" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Access" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Bindings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
  });

  test("renders schema-only discovered channels without bespoke shells or runtime crashes", async ({
    page,
  }) => {
    await setEnglishLocale(page);
    await stubChannelWorkspace(page, {
      channels: [],
      schemaOnlyChannelIds: ["discord"],
      gatewayStatus: "disconnected",
      config: {
        channels: {},
      },
    });

    await gotoDashboard(page);
    await setActivePanel(page, "channels");
    await page.getByRole("button", { name: /discord/i }).click();

    const detail = page.locator("main");
    await expect(page.getByRole("heading", { name: "discord" })).toBeVisible();
    await expect(detail.getByText("Not Configured", { exact: true }).last()).toBeVisible();
    await expect(page.getByTestId("wecom-shell-nav")).toHaveCount(0);
    await expect(detail.getByText("DM Policy", { exact: true })).toBeVisible();
    await expect(detail.getByText("Retry Strategy", { exact: true })).toBeVisible();
  });
});
