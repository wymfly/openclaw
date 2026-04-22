import { describe, expect, test } from "vitest";
import {
  assertValidWizardSpec,
  collectWizardSpecErrors,
  InvalidWizardSpecError,
} from "./wizard-spec.validator";

function buildValidSpec() {
  return {
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
          properties: {
            appId: { type: "string" },
          },
        },
      },
      {
        id: "probe",
        type: "action",
        title: "$t:plugin.feishu.step3Title",
        action: "channel.feishu.probe",
        params: {
          connectionMode: { $ref: "$steps.mode.value" },
        },
      },
    ],
    onComplete: {
      action: "channel.feishu.saveConfig",
      params: {
        appId: { $ref: "$steps.creds.value.appId" },
      },
    },
  };
}

describe("wizard spec validator", () => {
  test("accepts a valid spec", () => {
    expect(() => assertValidWizardSpec(buildValidSpec(), "feishu")).not.toThrow();
  });

  test("rejects duplicate step ids", () => {
    const spec = buildValidSpec();
    spec.steps[1] = { ...spec.steps[1], id: "mode" };
    expect(collectWizardSpecErrors(spec, "feishu")).toEqual(
      expect.arrayContaining([expect.stringContaining("duplicate step id")]),
    );
  });

  test("rejects invalid action namespace", () => {
    const spec = buildValidSpec();
    spec.onComplete.action = "deck.plugins.list";
    expect(collectWizardSpecErrors(spec, "feishu")).toEqual(
      expect.arrayContaining([expect.stringContaining("channel.feishu.")]),
    );
  });

  test("rejects invalid $ref syntax", () => {
    const spec = buildValidSpec();
    spec.onComplete.params = {
      appId: { $ref: "$globals.anything" },
    };
    expect(collectWizardSpecErrors(spec, "feishu")).toEqual(
      expect.arrayContaining([expect.stringContaining("invalid $ref syntax")]),
    );
  });

  test("rejects dangerous $ref segments", () => {
    const spec = buildValidSpec();
    spec.onComplete.params = {
      appId: { $ref: "$steps.creds.value.__proto__" },
    };
    expect(collectWizardSpecErrors(spec, "feishu")).toEqual(
      expect.arrayContaining([expect.stringContaining("disallowed $ref segment")]),
    );
  });

  test("throws InvalidWizardSpecError for invalid specs", () => {
    expect(() => assertValidWizardSpec({}, "feishu")).toThrow(InvalidWizardSpecError);
  });
});
