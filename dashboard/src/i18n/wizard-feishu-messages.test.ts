import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

const REQUIRED_KEYS = [
  "title",
  "step1Title",
  "step2Title",
  "step3Title",
  "modeWebSocket",
  "modeWebSocketDesc",
  "modeWebhook",
  "modeWebhookDesc",
  "pluginNotInstalled",
  "appId",
  "appIdHint",
  "appIdHelp",
  "appSecret",
  "appSecretHint",
  "appSecretHelp",
  "testDesc",
  "probeConfigNote",
  "probeSuccess",
  "probeNoChannel",
  "probeFailed",
] as const;

function assertFeishuMessages(messages: typeof en | typeof zh) {
  const wizard = messages.wizard as Record<string, unknown>;
  const feishu = wizard.feishu as Record<string, unknown>;

  expect(typeof wizard.recommended).toBe("string");
  expect(typeof wizard.unavailableTitle).toBe("string");
  expect(typeof wizard.unavailableDescription).toBe("string");
  for (const key of REQUIRED_KEYS) {
    expect(typeof feishu[key]).toBe("string");
    expect(String(feishu[key]).trim().length).toBeGreaterThan(0);
  }
}

describe("wizard feishu locale coverage", () => {
  it("keeps the required Feishu wizard messages in zh", () => {
    assertFeishuMessages(zh);
  });

  it("keeps the required Feishu wizard messages in en", () => {
    assertFeishuMessages(en);
  });
});
