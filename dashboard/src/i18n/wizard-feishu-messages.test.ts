import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

function assertWizardFallbackMessages(messages: typeof en | typeof zh) {
  const wizard = messages.wizard as Record<string, unknown>;

  expect(typeof wizard.recommended).toBe("string");
  expect(typeof wizard.unavailableTitle).toBe("string");
  expect(typeof wizard.unavailableDescription).toBe("string");
  expect(typeof wizard.feishu).toBe("undefined");
}

describe("wizard locale baseline", () => {
  it("keeps the generic wizard fallback messages in zh", () => {
    assertWizardFallbackMessages(zh);
  });

  it("keeps the generic wizard fallback messages in en", () => {
    assertWizardFallbackMessages(en);
  });
});
