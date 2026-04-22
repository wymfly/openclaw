// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WecomOnboardingPage } from "./WecomOnboardingPage";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const table: Record<string, Record<string, string>> = {
      "channels.wecomShell": {
        onboardingTitle: "WeCom Onboarding",
        onboardingDescription: "Onboarding description",
        onboardingConnected: `${values?.count ?? 0} connected account(s) detected.`,
        onboardingNotConnected: "No connected WeCom accounts detected yet.",
        openWizard: "Open Setup Wizard",
      },
      wizard: {
        "wecom.accessTabHint":
          "Detailed permission controls live in the Access tab after setup completes.",
      },
    };
    return table[ns]?.[key] ?? key;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WecomOnboardingPage", () => {
  it("shows connected-account summary and opens the descriptor dialog", () => {
    render(
      <WecomOnboardingPage
        channel={{
          id: "wecom",
          label: "WeCom",
          accounts: [{ accountId: "default", linked: true, connected: true }],
        }}
        onboardingDescriptor={{
          channelId: "wecom",
          kind: "adapter",
          titleKey: "channels.settings.configureWizard",
          renderPanel: () => null,
          renderDialog: ({ open }) => (open ? <div>WeCom Wizard Dialog</div> : null),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "WeCom Onboarding" })).toBeTruthy();
    expect(screen.getByText("1 connected account(s) detected.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Setup Wizard" }));
    expect(screen.getByText("WeCom Wizard Dialog")).toBeTruthy();
  });

  it("shows the disconnected state when no account is connected", () => {
    render(
      <WecomOnboardingPage
        channel={{
          id: "wecom",
          label: "WeCom",
          accounts: [
            { accountId: "default", linked: true, connected: false },
            { accountId: "other", linked: false, connected: false },
          ],
        }}
        onboardingDescriptor={null}
      />,
    );

    expect(screen.getByText("No connected WeCom accounts detected yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Setup Wizard" })).toBeNull();
  });
});
