// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateToRouting } from "../../../lib/panel-navigation";
import { useDeckRoutingStore } from "../../../stores/deck-routing";

const { useUIStoreMock, navigateToChannelAccessMock } = vi.hoisted(() => ({
  useUIStoreMock: {
    getState: () => ({
      setActivePanel: vi.fn(),
    }),
  },
  navigateToChannelAccessMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        accessControls: "Access Controls",
        accessControlsDescription: "Access controls help text",
        openAccess: "Open Access",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: { channelOrder: string[] }) => unknown) =>
    selector({ channelOrder: ["wecom"] }),
}));

vi.mock("@/stores/agents", () => ({
  useAgentsStore: (selector: (state: { agents: Array<{ id: string }> }) => unknown) =>
    selector({ agents: [] }),
}));

vi.mock("@/stores/ui", () => ({
  useUIStore: useUIStoreMock,
}));

vi.mock("../../../lib/panel-navigation", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/panel-navigation")>(
    "../../../lib/panel-navigation",
  );
  return {
    ...actual,
    navigateToChannelAccess: navigateToChannelAccessMock,
  };
});

vi.mock("../../ui/select", () => {
  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) {
    const items: Array<{ value: string; label: ReactNode }> = [];
    for (const child of Children.toArray(children)) {
      if (isValidElement(child)) {
        for (const nested of Children.toArray(child.props.children)) {
          if (isValidElement(nested) && typeof nested.props.value === "string") {
            items.push({ value: nested.props.value, label: nested.props.children });
          }
        }
      }
    }
    return (
      <select value={value} onChange={(event) => onValueChange(event.target.value)}>
        <option value="" />
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  return {
    Select,
    SelectTrigger: ({ children }: { children: ReactNode }) => children,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => children,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

let RouteSimulator: typeof import("./RouteSimulator").RouteSimulator;

beforeEach(async () => {
  ({ RouteSimulator } = await import("./RouteSimulator"));
  useDeckRoutingStore.setState({
    bindings: [],
    configHash: null,
    dmScope: null,
    loading: false,
    error: null,
    pendingSimulatorInput: null,
    conflictPairs: [],
    simulating: false,
    simulationResult: null,
    validating: false,
    validationResult: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RouteSimulator handoff", () => {
  it("preloads pending channel/account context from navigateToRouting and clears it after mount", async () => {
    navigateToRouting({ channelId: "wecom", accountId: "acct-main" });
    expect(useDeckRoutingStore.getState().pendingSimulatorInput).toEqual({
      channel: "wecom",
      accountId: "acct-main",
    });

    render(<RouteSimulator />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. srv-main").value).toBe("acct-main");
    });

    expect(useDeckRoutingStore.getState().pendingSimulatorInput).toBeNull();
  });

  it("offers an Access handoff for WeCom simulator context", async () => {
    navigateToRouting({ channelId: "wecom", accountId: "acct-main" });
    useDeckRoutingStore.setState({
      ...useDeckRoutingStore.getState(),
      simulationResult: {
        agentId: "main",
        matchedBy: "account",
        sessionKey: "wecom:acct-main:direct:user-1",
        tiers: [{ tier: "account", matched: true }],
      },
    });
    render(<RouteSimulator />);

    const button = await screen.findByRole("button", { name: /open access/i });
    button.click();

    expect(navigateToChannelAccessMock).toHaveBeenCalledWith("wecom", "acct-main");
  });
});
