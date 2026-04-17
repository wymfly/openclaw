// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityActionBar } from "./CapabilityActionBar";

const probeChannel = vi.fn(async () => {});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        login: "Login",
        probe: "Probe",
        probing: "Probing...",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/stores/plugins", () => ({
  usePluginsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      fetchPlugins: vi.fn(async () => {}),
      plugins: [
        {
          id: "feishu",
          channelIds: ["feishu"],
          deckActionCapabilities: {
            login: true,
            probe: true,
          },
        },
        {
          id: "discord",
          channelIds: ["discord"],
          deckActionCapabilities: {
            probe: true,
          },
        },
      ],
    }),
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      probeChannel,
      probing: new Set<string>(),
    }),
}));

vi.mock("./onboarding-registry", () => ({
  getChannelOnboardingDescriptor: (channelId: string) =>
    channelId === "feishu"
      ? {
          renderDialog: ({ open }: { open: boolean }) =>
            open ? <div>Feishu Login Wizard</div> : null,
        }
      : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  probeChannel.mockClear();
});

describe("CapabilityActionBar", () => {
  it("renders login and probe from metadata when a login surface exists", () => {
    render(<CapabilityActionBar channelId="feishu" />);

    expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Probe" })).toBeTruthy();
  });

  it("opens the onboarding dialog when login is clicked", () => {
    render(<CapabilityActionBar channelId="feishu" />);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByText("Feishu Login Wizard")).toBeTruthy();
  });

  it("runs the generic probe surface and activates the status tab when probe is clicked", () => {
    const onActivateStatusTab = vi.fn();
    render(<CapabilityActionBar channelId="discord" onActivateStatusTab={onActivateStatusTab} />);

    fireEvent.click(screen.getByRole("button", { name: "Probe" }));

    expect(onActivateStatusTab).toHaveBeenCalledTimes(1);
    expect(probeChannel).toHaveBeenCalledWith("discord");
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
  });
});
