// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityActionBar } from "./CapabilityActionBar";

const probeChannel = vi.fn(async () => {});
const addToast = vi.fn();

global.fetch = vi.fn() as unknown as typeof fetch;

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

vi.mock("@/stores/plugins", () => ({
  usePluginsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      fetchPlugins: vi.fn(async () => {}),
      plugins: [
        {
          id: "feishu",
          channelIds: ["feishu"],
          setupWizardSpec: {
            steps: [
              {
                id: "credentials",
                type: "info",
                title: "Credentials",
                body: "Enter credentials",
              },
            ],
            onComplete: { action: "channel.feishu.complete" },
          },
          deckActionCapabilities: {
            login: true,
            probe: true,
            testMessage: true,
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

vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addToast,
    }),
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      probeChannel,
      probing: new Set<string>(),
    }),
}));

vi.mock("@/features/channels/registry/channel-onboarding-descriptors", () => ({
  getLocalOnboardingDescriptor: (channelId: string) =>
    channelId === "wecom"
      ? {
          renderDialog: ({ open }: { open: boolean }) =>
            open ? <div>WeCom Login Wizard</div> : null,
        }
      : null,
}));

vi.mock("./wizard/wizard-spec-loader", () => ({
  ChannelWizardDialog: ({ channelId, open }: { channelId: string; open: boolean }) =>
    open ? <div>{`${channelId} Wizard Dialog`}</div> : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  probeChannel.mockClear();
  addToast.mockClear();
  vi.mocked(global.fetch).mockReset();
});

describe("CapabilityActionBar", () => {
  it("renders login and probe from metadata when a login surface exists", () => {
    render(<CapabilityActionBar channelId="feishu" />);

    expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Probe" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run Check" })).toBeTruthy();
  });

  it("opens the onboarding dialog when login is clicked", () => {
    render(<CapabilityActionBar channelId="feishu" />);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(screen.getByText("feishu Wizard Dialog")).toBeTruthy();
  });

  it("shows the WeCom login button through the real local descriptor path", () => {
    render(<CapabilityActionBar channelId="wecom" />);

    expect(screen.getByRole("button", { name: "Login" })).toBeTruthy();
  });

  it("runs the generic probe surface and activates the status tab when probe is clicked", () => {
    const onActivateStatusTab = vi.fn();
    render(<CapabilityActionBar channelId="discord" onActivateStatusTab={onActivateStatusTab} />);

    fireEvent.click(screen.getByRole("button", { name: "Probe" }));

    expect(onActivateStatusTab).toHaveBeenCalledTimes(1);
    expect(probeChannel).toHaveBeenCalledWith("discord");
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
  });

  it("reuses the generic channel test route when testMessage is clicked", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(<CapabilityActionBar channelId="feishu" />);

    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));

    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith("/api/channels/feishu/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith("success", "Check passed", 3000);
    });
  });
});
