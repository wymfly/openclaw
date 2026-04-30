import { describe, expect, it } from "vitest";
import en from "../locales/en.json" with { type: "json" };
import zh from "../locales/zh.json" with { type: "json" };

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

function assertLocaleBundle(messages: typeof en | typeof zh) {
  for (const key of REQUIRED_KEYS) {
    expect(typeof messages[key]).toBe("string");
    expect(messages[key].trim().length).toBeGreaterThan(0);
  }
}

describe("feishu plugin locale bundles", () => {
  it("keeps the required english wizard messages", () => {
    assertLocaleBundle(en);
  });

  it("keeps the required chinese wizard messages", () => {
    assertLocaleBundle(zh);
  });
});
