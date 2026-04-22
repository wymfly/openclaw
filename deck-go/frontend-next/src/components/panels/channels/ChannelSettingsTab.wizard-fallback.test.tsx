// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelSettingsTab } from "./ChannelSettingsTab";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        configureWizard: "Configure Connection (Wizard)",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: () => ({
    channelSchemas: new Map([
      [
        "feishu",
        {
          configPath: "channels.feishu",
          schema: { properties: { appId: { type: "string" } } },
        },
      ],
    ]),
  }),
}));

vi.mock("@/features/channels/registry/channel-ui-authority", () => ({
  resolveChannelUiDefinition: () => ({
    onboarding: {
      kind: "wizard-spec",
      source: "fallback",
      hasDescriptor: false,
      hasWizardSpec: true,
    },
    onboardingDescriptor: null,
    accessDescriptor: null,
    ownership: { settings: "hybrid" },
  }),
}));

vi.mock("./ChannelLegacySettingsPanel", () => ({
  ChannelLegacySettingsPanel: ({ channelId }: { channelId: string }) => (
    <div>{`Legacy Settings:${channelId}`}</div>
  ),
}));

vi.mock("./ChannelSchemaSettings", () => ({
  ChannelSchemaSettings: ({ channelId }: { channelId: string }) => (
    <div>{`Schema Settings:${channelId}`}</div>
  ),
}));

vi.mock("./wizard/wizard-spec-loader", () => ({
  ChannelWizardDialog: ({ channelId, open }: { channelId: string; open: boolean }) =>
    open ? <div>{`Wizard Dialog:${channelId}`}</div> : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelSettingsTab wizard-spec fallback", () => {
  it("still renders the wizard entry and opens ChannelWizardDialog without a local onboarding descriptor", () => {
    render(<ChannelSettingsTab channelId="feishu" />);

    expect(screen.getByText("Legacy Settings:feishu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Configure Connection (Wizard)" }));
    expect(screen.getByText("Wizard Dialog:feishu")).toBeTruthy();
  });
});
