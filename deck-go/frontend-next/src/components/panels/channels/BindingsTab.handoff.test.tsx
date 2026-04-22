// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateToRouting } = vi.hoisted(() => ({
  navigateToRouting: vi.fn(),
}));

const channelsState = {
  channelOrder: ["wecom"],
  channels: new Map([
    [
      "wecom",
      {
        id: "wecom",
        label: "WeCom",
        accounts: [
          { accountId: "default", name: "Default" },
          { accountId: "tenant-b", name: "Tenant B" },
        ],
      },
    ],
  ]),
};

const routingState = {
  bindings: [],
  configHash: "hash-1",
  dmScope: null,
  loading: false,
  conflictPairs: [],
  addBinding: vi.fn(async () => true),
  fetchBindings: vi.fn(async () => {}),
  removeBinding: vi.fn(async () => true),
};

const useDeckRoutingStoreMock = ((selector?: (state: typeof routingState) => unknown) =>
  selector ? selector(routingState) : routingState) as ((
  selector?: (state: typeof routingState) => unknown,
) => unknown) & {
  getState: () => typeof routingState;
};
useDeckRoutingStoreMock.getState = () => routingState;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        loading: "Loading",
        openRouting: "Open Routing",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToRouting,
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: typeof channelsState) => unknown) => selector(channelsState),
}));

vi.mock("@/stores/deck-routing", () => ({
  useDeckRoutingStore: useDeckRoutingStoreMock,
}));

vi.mock("@/components/shared/BindingDialog", () => ({
  BindingDialog: () => null,
}));

vi.mock("@/components/shared/AgentBadge", () => ({
  AgentBadge: () => <div>agent-badge</div>,
}));

vi.mock("@/components/shared/TierBadge", () => ({
  TierBadge: () => <div>tier-badge</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <div data-value={value}>
      {children}
      <button onClick={() => onValueChange?.("tenant-b")}>select-tenant-b</button>
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

let BindingsTab: typeof import("./BindingsTab").BindingsTab;

beforeEach(async () => {
  vi.resetModules();
  ({ BindingsTab } = await import("./BindingsTab"));
  navigateToRouting.mockReset();
  routingState.fetchBindings.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("BindingsTab routing handoff", () => {
  it("preserves channel and selected account context when opening routing", () => {
    render(<BindingsTab channelId="wecom" />);

    fireEvent.click(screen.getByText("select-tenant-b"));
    fireEvent.click(screen.getByRole("button", { name: /open routing/i }));

    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: "tenant-b",
    });
  });

  it("falls back to channel-only context when no account is selected", () => {
    render(<BindingsTab channelId="wecom" />);

    fireEvent.click(screen.getByRole("button", { name: /open routing/i }));

    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: undefined,
    });
  });
});
