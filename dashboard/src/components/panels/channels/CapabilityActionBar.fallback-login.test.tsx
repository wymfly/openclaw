// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityActionBar } from "./CapabilityActionBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        login: "Login",
        probe: "Probe",
        probing: "Probing...",
        testMessage: "Run Check",
        testingMessage: "Checking...",
        testMessageSuccess: "Check passed",
        testMessageFailed: "Check failed",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/features/channels/registry/channel-ui-authority", () => ({
  resolveChannelUiDefinition: () => ({
    actions: [{ key: "login", enabled: true, behavior: "generic", source: "fallback" }],
    onboarding: {
      kind: "wizard-spec",
      source: "fallback",
      hasDescriptor: false,
      hasWizardSpec: true,
    },
    onboardingDescriptor: null,
  }),
}));

vi.mock("@/stores/plugins", () => ({
  usePluginsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      fetchPlugins: vi.fn(async () => {}),
      plugins: [],
    }),
}));

vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addToast: vi.fn(),
    }),
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      probeChannel: vi.fn(async () => {}),
      probing: new Set<string>(),
    }),
}));

vi.mock("./wizard/wizard-spec-loader", () => ({
  ChannelWizardDialog: ({ channelId, open }: { channelId: string; open: boolean }) =>
    open ? <div>{`Fallback Wizard:${channelId}`}</div> : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CapabilityActionBar fallback wizard login", () => {
  it("opens the generic ChannelWizardDialog when login is driven by fallback wizard metadata", () => {
    render(<CapabilityActionBar channelId="feishu" />);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByText("Fallback Wizard:feishu")).toBeTruthy();
  });
});
