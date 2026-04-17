// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WizardRunner } from "./WizardRunner";

const updateChannelConfig = vi.fn(async () => true);

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const table: Record<string, Record<string, string>> = {
      common: { cancel: "Cancel" },
      wizard: {
        complete: "Complete",
        next: "Next",
        back: "Back",
        validating: "Validating",
        testing: "Testing",
        testConnection: "Test Connection",
        recommended: "Recommended",
        stepProgress: "Step progress",
      },
      plugin: {
        "feishu.title": "Configure Feishu",
        "feishu.step1Title": "Mode",
        "feishu.step2Title": "Credentials",
        "feishu.step3Title": "Validation",
        "feishu.modeWebSocket": "WebSocket",
        "feishu.modeWebSocketDesc": "WS Desc",
        "feishu.modeWebhook": "Webhook",
        "feishu.modeWebhookDesc": "Webhook Desc",
        "feishu.appId": "App ID",
        "feishu.appIdHint": "app-id",
        "feishu.appIdHelp": "App ID help",
        "feishu.appSecret": "App Secret",
        "feishu.appSecretHint": "app-secret",
        "feishu.appSecretHelp": "App Secret help",
        "feishu.testDesc": "Run probe",
        "feishu.probeSuccess": "Probe success",
        "feishu.probeFailed": "Probe failed",
        "feishu.pluginNotInstalled": "Plugin missing",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      channelOrder: ["feishu"],
      updateChannelConfig,
    }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  updateChannelConfig.mockClear();
});

describe("WizardRunner", () => {
  test("walks the feishu-style flow and saves config on complete", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ channels: { feishu: { ok: true } } }),
    })) as unknown as typeof globalThis.fetch;

    render(
      <WizardRunner
        channelId="feishu"
        open
        onOpenChange={vi.fn()}
        spec={{
          steps: [
            {
              id: "mode",
              type: "radio",
              title: "$t:plugin.feishu.step1Title",
              options: [
                { value: "websocket", label: "$t:plugin.feishu.modeWebSocket" },
                { value: "webhook", label: "$t:plugin.feishu.modeWebhook" },
              ],
            },
            {
              id: "creds",
              type: "form",
              title: "$t:plugin.feishu.step2Title",
              schema: {
                type: "object",
                required: ["appId", "appSecret"],
                properties: {
                  appId: { type: "string", title: "$t:plugin.feishu.appId" },
                  appSecret: {
                    type: "string",
                    title: "$t:plugin.feishu.appSecret",
                    format: "password",
                  },
                },
              },
            },
            {
              id: "probe",
              type: "action",
              title: "$t:plugin.feishu.step3Title",
              action: "channel.feishu.probe",
              successMessage: "$t:plugin.feishu.probeSuccess",
              failureMessage: "$t:plugin.feishu.probeFailed",
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
        }}
      />,
    );

    fireEvent.click(screen.getByText("WebSocket"));
    await waitFor(() => {
      expect(screen.getByText("Mode")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Credentials")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("App ID"), { target: { value: "app-id" } });
    fireEvent.change(screen.getByLabelText("App Secret"), { target: { value: "app-secret" } });
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Validation")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Test Connection"));
    await waitFor(() => {
      expect(screen.getByText("Probe success")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Complete"));
    await waitFor(() => {
      expect(updateChannelConfig).toHaveBeenCalledWith("feishu", {
        connectionMode: "websocket",
        appId: "app-id",
        appSecret: "app-secret",
      });
    });
  });
});
