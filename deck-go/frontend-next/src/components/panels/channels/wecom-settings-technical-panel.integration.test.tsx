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
      },
    };
    return tables[ns]?.[key] ?? key;
  },
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("./ChannelSchemaSettings", () => ({
  ChannelSchemaSettings: ({ excludePaths }: { excludePaths?: string[] }) => (
    <div>schema-settings:{excludePaths?.join("|") ?? "none"}</div>
  ),
}));

vi.mock("./ChannelLegacySettingsPanel", () => ({
  ChannelLegacySettingsPanel: () => <div>legacy-panel</div>,
}));

vi.mock("./WeComWizard", () => ({
  WeComWizard: () => null,
}));

let ChannelSettingsTab: typeof import("./ChannelSettingsTab").ChannelSettingsTab;

beforeEach(async () => {
  vi.resetModules();
  ({ ChannelSettingsTab } = await import("./ChannelSettingsTab"));
  useChannelsStoreMock.setState({
    channelSchemas: new Map([
      [
        "wecom",
        {
          configPath: "channels.wecom",
          schema: {
            properties: {
              bot: {
                type: "object",
                properties: { dm: { type: "object" }, webhook: { type: "object" } },
              },
              dynamicAgents: { type: "object" },
              routing: {
                type: "object",
                properties: { failClosedOnDefaultRoute: { type: "boolean" } },
              },
              media: { type: "object", properties: { maxBytes: { type: "number" } } },
            },
          },
        },
      ],
    ]),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WeCom settings technical panel", () => {
  it("uses schema-driven technical settings with access-owned fields excluded while keeping the wizard entry", () => {
    render(<ChannelSettingsTab channelId="wecom" />);

    expect(screen.getByText("Configure Connection (Wizard)")).toBeTruthy();
    expect(
      screen.getByText(
        "schema-settings:bot.dm|agent.dm|dynamicAgents|routing.failClosedOnDefaultRoute|accounts.*.bot.dm|accounts.*.agent.dm",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("legacy-panel")).toBeNull();
  });
});
