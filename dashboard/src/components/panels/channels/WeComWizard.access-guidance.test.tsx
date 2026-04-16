// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateToChannelAccess } = vi.hoisted(() => ({
  navigateToChannelAccess: vi.fn(),
}));

const storeState: Record<string, unknown> = {};
const useChannelsStoreMock = ((selector?: (state: Record<string, unknown>) => unknown) =>
  selector ? selector(storeState) : storeState) as ((
  selector?: (state: Record<string, unknown>) => unknown,
) => unknown) & {
  setState: (next: Record<string, unknown>) => void;
};
useChannelsStoreMock.setState = (next) => {
  for (const key of Object.keys(storeState)) {
    delete storeState[key];
  }
  Object.assign(storeState, next);
};

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    const tables: Record<string, Record<string, string>> = {
      wizard: {
        testing: "Testing...",
        testConnection: "Test Connection",
        "wecom.title": "Configure WeCom",
        "wecom.step1Title": "Step 1",
        "wecom.step2Title": "Step 2",
        "wecom.step3Title": "DM Policy",
        "wecom.step4Title": "Step 4",
        "wecom.step5Title": "Step 5",
        "wecom.dmPolicyLabel": "Choose DM policy",
        "wecom.accessTabHint":
          "Detailed permission controls live in the Access tab after setup completes.",
        "wecom.saveFailed": "Unable to save WeCom settings.",
      },
    };
    return tables[ns]?.[key] ?? key;
  },
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToChannelAccess,
}));

vi.mock("./ConfigWizard", () => ({
  ConfigWizard: ({
    steps,
    onComplete,
  }: {
    steps: Array<{ content: React.ReactNode }>;
    onComplete: () => void;
  }) => (
    <div>
      {steps.map((step, index) => (
        <div key={index}>{step.content}</div>
      ))}
      <button onClick={onComplete}>complete-wizard</button>
    </div>
  ),
}));

let WeComWizard: typeof import("./WeComWizard").WeComWizard;

beforeEach(async () => {
  vi.resetModules();
  navigateToChannelAccess.mockReset();
  ({ WeComWizard } = await import("./WeComWizard"));
  useChannelsStoreMock.setState({
    channelOrder: ["wecom"],
    updateChannelConfig: vi.fn(async () => true),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WeComWizard access guidance", () => {
  it("shows Access-tab guidance and navigates to Access on completion", async () => {
    render(<WeComWizard open onOpenChange={vi.fn()} />);

    expect(
      screen.getByText(
        "Detailed permission controls live in the Access tab after setup completes.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("complete-wizard"));
    await waitFor(() => {
      expect(navigateToChannelAccess).toHaveBeenCalledWith("wecom");
    });
  });

  it("does not close or navigate to Access when saving fails", async () => {
    const onOpenChange = vi.fn();
    useChannelsStoreMock.setState({
      channelOrder: ["wecom"],
      updateChannelConfig: vi.fn(async () => false),
    });

    render(<WeComWizard open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText("complete-wizard"));

    await waitFor(() => {
      expect(screen.getByText("Unable to save WeCom settings.")).toBeTruthy();
    });
    expect(navigateToChannelAccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
