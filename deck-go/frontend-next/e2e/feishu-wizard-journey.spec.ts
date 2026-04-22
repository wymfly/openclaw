import { expect, test, type Page } from "@playwright/test";
import { buildMockChannel, buildMockChannelAccount, buildMockPlugin } from "./channel-fixtures";
import {
  gotoDashboard,
  setActivePanel,
  setEnglishLocale,
  stubChannelWorkspace,
  type MockChannelWorkspaceHarness,
} from "./helpers";

const feishuChannel = buildMockChannel({
  id: "feishu",
  label: "Feishu Ops",
  detailLabel: "Feishu Operations",
  pluginId: "feishu",
  pluginOrigin: "bundled",
  pluginConfigPath: "plugins.entries.feishu.config",
  defaultAccountId: "primary",
  accounts: [
    buildMockChannelAccount({
      accountId: "primary",
      name: "Primary Workspace",
      connected: true,
      probe: { ok: true, latencyMs: 56 },
    }),
  ],
});

const feishuWizardSpec = {
  steps: [
    {
      id: "mode",
      type: "radio",
      title: "Choose Mode",
      options: [
        {
          value: "websocket",
          label: "WebSocket",
          description: "Use websocket delivery for the first setup lane.",
          badge: "Recommended",
        },
        {
          value: "webhook",
          label: "Webhook",
          description: "Use callback delivery instead of websocket.",
        },
      ],
    },
    {
      id: "creds",
      type: "form",
      title: "Credentials",
      schema: {
        type: "object",
        required: ["appId", "appSecret"],
        properties: {
          appId: {
            type: "string",
            title: "App ID",
            placeholder: "feishu-app-id",
          },
          appSecret: {
            type: "string",
            format: "password",
            title: "App Secret",
            placeholder: "feishu-app-secret",
          },
        },
      },
    },
    {
      id: "probe",
      type: "action",
      title: "Validate Connection",
      description: "Run the current probe route before completing setup.",
      action: "channel.feishu.probe",
      successMessage: "Feishu probe succeeded",
      failureMessage: "Feishu probe failed",
    },
  ],
  onComplete: {
    action: "channel.feishu.saveConfig",
    params: {
      connectionMode: { $ref: "$steps.mode.value" },
      appId: { $ref: "$steps.creds.value.appId" },
      appSecret: { $ref: "$steps.creds.value.appSecret" },
    },
  },
} as const;

const feishuPlugin = buildMockPlugin({
  id: "feishu",
  name: "Feishu Plugin",
  channelIds: ["feishu"],
  setupWizardSpec: feishuWizardSpec,
  locales: {
    en: {
      title: "Feishu Plugin",
    },
  },
  deckActionCapabilities: {
    login: true,
    probe: true,
    testMessage: true,
  },
});

async function openFeishuChannel(page: Page): Promise<MockChannelWorkspaceHarness> {
  await setEnglishLocale(page);
  const harness = await stubChannelWorkspace(page, {
    channels: [feishuChannel],
    plugins: [feishuPlugin],
    config: {
      channels: {
        feishu: {},
      },
    },
    gatewayStatus: "connected",
    channelTestResults: {
      feishu: {
        ok: true,
        check: "probe",
      },
    },
  });

  await gotoDashboard(page);
  await setActivePanel(page, "channels");
  await page.getByRole("button", { name: /Feishu Ops/i }).click();
  await expect(page.getByRole("heading", { name: "Feishu Ops" })).toBeVisible();

  return harness;
}

test.describe("@mock Feishu wizard journey", () => {
  test("shows capability-driven actions and runs the wizard probe step through the current probe route", async ({
    page,
  }) => {
    await openFeishuChannel(page);
    const actionBarCheck = page.getByRole("button", { name: "Run Check" }).first();

    await expect(page.getByTestId("wecom-shell-nav")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Probe" })).toBeVisible();
    await expect(actionBarCheck).toBeVisible();

    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Feishu Plugin" })).toBeVisible();
    await expect(page.getByText("Choose Mode", { exact: true })).toBeVisible();

    await page
      .getByText("WebSocket", { exact: true })
      .locator("xpath=ancestor::*[@role='button'][1]")
      .click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("App ID").fill("app-123");
    await page.getByLabel("App Secret").fill("secret-xyz");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Validate Connection", { exact: true })).toBeVisible();
    const probeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/channels?probe=true"),
    );
    await page.getByRole("button", { name: "Test Connection" }).click();
    await probeResponse;
    await expect(page.getByText("Feishu probe succeeded")).toBeVisible();
  });

  test("sends metadata-driven test requests and saves wizard config through the channel patch route", async ({
    page,
  }) => {
    const harness = await openFeishuChannel(page);
    const actionBarCheck = page.getByRole("button", { name: "Run Check" }).first();

    await actionBarCheck.click();
    await expect.poll(() => harness.channelTestRequests.length).toBe(1);
    expect(harness.channelTestRequests[0]).toEqual({
      channelId: "feishu",
      body: {},
    });

    await page.getByRole("button", { name: "Login" }).click();
    await page
      .getByText("WebSocket", { exact: true })
      .locator("xpath=ancestor::*[@role='button'][1]")
      .click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("App ID").fill("app-123");
    await page.getByLabel("App Secret").fill("secret-xyz");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Complete" }).click();

    await expect.poll(() => harness.channelUpdateRequests.length).toBe(1);
    expect(harness.channelUpdateRequests[0]).toEqual({
      channelId: "feishu",
      body: {
        connectionMode: "websocket",
        appId: "app-123",
        appSecret: "secret-xyz",
      },
    });
  });
});
