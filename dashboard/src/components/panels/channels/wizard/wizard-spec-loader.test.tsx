// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelWizardDialog } from "./wizard-spec-loader";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        unavailableTitle: "Wizard unavailable",
        unavailableDescription: "No wizard spec",
        loading: "Loading",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => children,
  DialogHeader: ({ children }: { children: unknown }) => children,
  DialogTitle: ({ children }: { children: unknown }) => children,
  DialogDescription: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/stores/plugins", () => ({
  usePluginsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      loading: false,
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
        },
        {
          id: "wecom",
          channelIds: ["wecom"],
          setupWizardSpec: {
            steps: [
              {
                id: "credentials",
                type: "info",
                title: "Credentials",
                body: "Enter credentials",
              },
            ],
            onComplete: { action: "channel.wecom.complete" },
          },
        },
      ],
    }),
}));

vi.mock("./WizardRunner", () => ({
  WizardRunner: ({ channelId }: { channelId: string }) => <div>{`WizardRunner:${channelId}`}</div>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelWizardDialog", () => {
  it("renders the DSL runner for Feishu when a wizard spec exists", () => {
    render(<ChannelWizardDialog channelId="feishu" open onOpenChange={() => {}} />);

    expect(screen.getByText("WizardRunner:feishu")).toBeTruthy();
  });

  it("returns no dialog for channels whose authority does not use wizard-spec onboarding", () => {
    const { container } = render(
      <ChannelWizardDialog channelId="wecom" open onOpenChange={() => {}} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
