import { expect, test, type Page } from "@playwright/test";
import {
  buildMockChannel,
  buildMockChannelAccount,
  buildMockPlugin,
  buildMockRoutingBinding,
} from "./channel-fixtures";
import {
  gotoDashboard,
  setActivePanel,
  setEnglishLocale,
  stubChannelWorkspace,
  type MockChannelWorkspaceHarness,
} from "./helpers";

const wecomChannel = buildMockChannel({
  id: "wecom",
  label: "WeCom Ops",
  detailLabel: "WeCom Operations",
  pluginId: "wecom",
  pluginOrigin: "bundled",
  pluginConfigPath: "plugins.entries.wecom.config",
  defaultAccountId: "acct-bot",
  accounts: [
    buildMockChannelAccount({
      accountId: "acct-bot",
      name: "Operations Bot",
      connected: true,
      probe: { ok: true, latencyMs: 82 },
    }),
    buildMockChannelAccount({
      accountId: "acct-agent",
      name: "Operations Agent",
      connected: false,
      lastError: "Allowlist empty",
      probe: { ok: false, error: "allowlist empty" },
    }),
  ],
});

const wecomPlugin = buildMockPlugin({
  id: "wecom",
  name: "WeCom Plugin",
  channelIds: ["wecom"],
  activationSource: "channel",
  activationReason: "runtime-enabled",
  diagnostics: [{ level: "info", message: "Bundled plugin ready" }],
});

const baseWecomConfig = {
  channels: {
    wecom: {
      defaultAccount: "acct-bot",
      accounts: {
        "acct-bot": {
          bot: { dm: { policy: "open", allowFrom: [] } },
          agent: { dm: { policy: "pairing", allowFrom: [] } },
        },
        "acct-agent": {
          bot: { dm: { policy: "pairing", allowFrom: [] } },
          agent: { dm: { policy: "allowlist", allowFrom: [] } },
        },
      },
      dynamicAgents: {
        enabled: true,
        dmCreateAgent: true,
        groupEnabled: true,
        adminUsers: [],
      },
      routing: {
        failClosedOnDefaultRoute: false,
      },
    },
  },
};

async function openWecomChannel(
  page: Page,
  options?: {
    bindings?: ReturnType<typeof buildMockRoutingBinding>[];
    config?: Record<string, unknown>;
  },
): Promise<MockChannelWorkspaceHarness> {
  await setEnglishLocale(page);
  const harness = await stubChannelWorkspace(page, {
    channels: [wecomChannel],
    plugins: [wecomPlugin],
    bindings: options?.bindings ?? [],
    config: options?.config ?? baseWecomConfig,
    gatewayStatus: "connected",
  });

  await gotoDashboard(page);
  await setActivePanel(page, "channels");
  await page.getByRole("button", { name: /WeCom Ops/i }).click();
  await expect(page.getByTestId("wecom-shell-nav")).toBeVisible();

  return harness;
}

test.describe("@mock WeCom channel journey", () => {
  test("shows only Overview, Onboarding, and Access in the WeCom shell nav", async ({ page }) => {
    await openWecomChannel(page, {
      bindings: [
        buildMockRoutingBinding({
          id: "binding-wecom",
          agentId: "main",
          match: { channel: "wecom" },
        }),
      ],
    });

    const shellNav = page.getByTestId("wecom-shell-nav");
    await expect(shellNav.getByRole("button", { name: "Overview" })).toBeVisible();
    await expect(shellNav.getByRole("button", { name: "Onboarding" })).toBeVisible();
    await expect(shellNav.getByRole("button", { name: "Access" })).toBeVisible();

    await expect(shellNav.getByRole("button", { name: "Settings" })).toHaveCount(0);
    await expect(shellNav.getByRole("button", { name: "Diagnostics" })).toHaveCount(0);
    await expect(shellNav.getByRole("button", { name: "Capabilities" })).toHaveCount(0);
    await expect(shellNav.getByRole("button", { name: "Bindings" })).toHaveCount(0);
    await expect(shellNav.getByRole("button", { name: "Analytics" })).toHaveCount(0);

    await expect(page.getByRole("tab", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Access" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bindings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Analytics" })).toBeVisible();
  });

  test("opens Access from the status-side summary, preserves the target account, and saves a narrow patch", async ({
    page,
  }) => {
    const harness = await openWecomChannel(page, {
      bindings: [
        buildMockRoutingBinding({
          id: "binding-wecom-agent",
          agentId: "main",
          match: { channel: "wecom", accountId: "acct-agent" },
        }),
      ],
    });

    const accountAlert = page
      .getByText(/acct-agent: agent allowlist mode is enabled but allowFrom is empty\./i, {
        exact: true,
      })
      .locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
    await expect(accountAlert).toBeVisible();
    await accountAlert.getByRole("button", { name: "Open Access" }).click();

    const shellNav = page.getByTestId("wecom-shell-nav");
    await expect(shellNav.getByRole("button", { name: "Access" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("combobox")).toContainText("acct-agent");

    const agentSection = page
      .getByText("Agent DM Policy · Operations Agent", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await agentSection
      .getByRole("radio", {
        name: /^Open Anyone can DM the bot\./,
      })
      .click();
    await agentSection.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => harness.configPatchRequests.length).toBe(1);
    expect(harness.configPatchRequests[0]?.patch).toEqual({
      channels: {
        wecom: {
          accounts: {
            "acct-agent": {
              agent: {
                dm: {
                  policy: "open",
                  allowFrom: [],
                },
              },
            },
          },
        },
      },
    });
  });

  test("keeps runtime truth in Channels and hands off plugin identity to the Plugins panel", async ({
    page,
  }) => {
    await openWecomChannel(page, {
      bindings: [
        buildMockRoutingBinding({
          id: "binding-wecom",
          agentId: "main",
          match: { channel: "wecom" },
        }),
      ],
    });

    await expect(page.getByText("Plugin:")).toBeVisible();
    await expect(page.getByText("wecom", { exact: true })).toBeVisible();
    await expect(page.getByText("Origin:")).toBeVisible();
    await expect(page.getByText("bundled", { exact: true })).toBeVisible();
    await expect(page.getByText("Plugin Config Key:")).toBeVisible();
    await expect(page.getByText("plugins.entries.wecom.config")).toBeVisible();
    await expect(page.getByText("Account Diagnostics", { exact: true })).toBeVisible();
    await expect(page.getByText("Accounts (2)")).toBeVisible();

    await page.getByRole("button", { name: "Open Plugin" }).click();

    await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
    await expect(page.getByText("WeCom Plugin")).toBeVisible();
    await expect(
      page.getByText(
        "Read-only inventory of plugin identity, origin, capabilities, and diagnostics. Lifecycle controls are intentionally deferred.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Open wecom" })).toBeVisible();
  });
});
