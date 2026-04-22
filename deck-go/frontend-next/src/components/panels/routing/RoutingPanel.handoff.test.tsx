// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deckRoutingState: Record<string, unknown> = {};
const useDeckRoutingStoreMock = ((selector?: (state: Record<string, unknown>) => unknown) =>
  selector ? selector(deckRoutingState) : deckRoutingState) as ((
  selector?: (state: Record<string, unknown>) => unknown,
) => unknown) & {
  setState: (next: Record<string, unknown>) => void;
};
useDeckRoutingStoreMock.setState = (next) => {
  for (const key of Object.keys(deckRoutingState)) {
    delete deckRoutingState[key];
  }
  Object.assign(deckRoutingState, next);
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const table: Record<string, string> = {
      bindings: "Bindings",
      simulator: "Simulator",
      activityFeed: "Activity Feed",
    };
    return table[key] ?? key;
  },
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/stores/deck-routing", () => ({
  useDeckRoutingStore: useDeckRoutingStoreMock,
}));

vi.mock("./BindingTable", () => ({ BindingTable: () => <div>bindings-pane</div> }));
vi.mock("./RouteSimulator", () => ({ RouteSimulator: () => <div>simulator-pane</div> }));
vi.mock("./ActivityFeed", () => ({ ActivityFeed: () => <div>activity-pane</div> }));
let currentTabsValue = "";

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value }: { children: ReactNode; value: string }) => {
    currentTabsValue = value;
    return <div>{children}</div>;
  },
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ value, children }: { value: string; children: ReactNode }) => {
    return currentTabsValue === value ? <div>{children}</div> : null;
  },
}));

let RoutingPanel: typeof import("./RoutingPanel").RoutingPanel;

beforeEach(async () => {
  vi.resetModules();
  ({ RoutingPanel } = await import("./RoutingPanel"));
  useDeckRoutingStoreMock.setState({
    pendingSimulatorInput: { channel: "wecom", accountId: "acct-main" },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoutingPanel handoff", () => {
  it("opens narrow layouts on the simulator tab when pending simulator input exists", () => {
    render(<RoutingPanel />);
    expect(screen.getByText("simulator-pane")).toBeTruthy();
  });
});
