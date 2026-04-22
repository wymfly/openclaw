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
  useTranslations: () => (key: string) => {
    const table: Record<string, string> = {
      "analytics.totalIn": "Messages In",
      "analytics.totalOut": "Messages Out",
      "analytics.errorRate": "Error Rate",
      "analytics.latency": "Latency",
      "analytics.throughput": "Throughput",
      "analytics.placeholder": "Placeholder",
      "analytics.noData": "No data",
      "analytics.runtimeHealth": "Runtime Health",
      "analytics.runtimeHealthDescription": "Live runtime summary",
      "analytics.runtimeConnected": "Connected Accounts",
      "analytics.runtimeConfigured": "Configured Accounts",
      "analytics.runtimeErrors": "Accounts With Errors",
      "analytics.runtimeDefaultAccount": "Default Account",
    };
    return table[key] ?? key;
  },
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("./ThroughputChart", () => ({
  ThroughputChart: () => <div>throughput-chart</div>,
}));

let ChannelAnalytics: typeof import("./ChannelAnalytics").ChannelAnalytics;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelAnalytics } = await import("./ChannelAnalytics"));
  useChannelsStoreMock.setState({
    throughput: new Map([
      [
        "wecom",
        {
          buckets: [],
          messagesIn: 12,
          messagesOut: 8,
        },
      ],
    ]),
    fetchThroughput: vi.fn(),
    channelHealthMap: new Map([
      [
        "wecom",
        {
          status: "degraded",
          latencyMs: 123,
          lastCheckedAt: Date.now(),
        },
      ],
    ]),
    channels: new Map([
      [
        "wecom",
        {
          id: "wecom",
          label: "WeCom",
          defaultAccountId: "default",
          accounts: [
            { accountId: "default", configured: true, connected: true },
            { accountId: "tenant-b", configured: true, connected: false, lastError: "Auth failed" },
          ],
        },
      ],
    ]),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChannelAnalytics", () => {
  it("renders runtime health metrics alongside throughput placeholders", () => {
    render(<ChannelAnalytics channelId="wecom" />);

    expect(screen.getByText("Runtime Health")).toBeTruthy();
    expect(screen.getByText("Live runtime summary")).toBeTruthy();
    expect(screen.getByText("Connected Accounts")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Configured Accounts")).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(screen.getByText("Accounts With Errors")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Default Account")).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("throughput-chart")).toBeTruthy();
  });
});
