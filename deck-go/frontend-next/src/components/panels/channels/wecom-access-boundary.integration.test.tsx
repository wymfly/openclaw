// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      "channels.settings": {
        configureWizard: "Configure Connection (Wizard)",
        accessMoved:
          "Permission editing now lives in the Access tab. Settings keeps connection and retry behavior only.",
        "retry.title": "Retry Strategy",
        "retry.attempts": "Attempts",
        "retry.minDelay": "Min Delay (ms)",
        "retry.maxDelay": "Max Delay (ms)",
        "retry.jitter": "Jitter",
        "retry.totalTime": "Total time",
      },
      common: {
        loading: "Loading",
        save: "Save",
        cancel: "Cancel",
      },
    };
    return tables[ns]?.[key] ?? key;
  },
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("./WeComWizard", () => ({
  WeComWizard: () => null,
}));

let ChannelSettingsTab: typeof import("./ChannelSettingsTab").ChannelSettingsTab;

beforeEach(async () => {
  ({ ChannelSettingsTab } = await import("./ChannelSettingsTab"));
  useChannelsStoreMock.setState({
    channelSchemas: new Map(),
    channelConfig: { retry: { attempts: 3, minDelayMs: 1000, maxDelayMs: 30000, jitter: 0.2 } },
    channelConfigSaveError: null,
    fetchChannelConfig: vi.fn(async () => {}),
    saveChannelConfig: vi.fn(async () => true),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WeCom settings/access boundary", () => {
  it("hides legacy DM policy editing from the WeCom settings path and shows the Access handoff", async () => {
    render(<ChannelSettingsTab channelId="wecom" />);

    expect(
      await screen.findByText(
        "Permission editing now lives in the Access tab. Settings keeps connection and retry behavior only.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("DM Policy")).toBeNull();
    expect(screen.getByText("Configure Connection (Wizard)")).toBeTruthy();
  });
});
