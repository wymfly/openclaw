// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateToRouting } = vi.hoisted(() => ({
  navigateToRouting: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) => {
    const fullKey = ns ? `${ns}.${key}` : key;
    const table: Record<string, string> = {
      "channels.bindingsTab.openRouting": "View all routing rules",
      "channels.bindingsTab.summaryTitle": "Routing Scope Summary",
      "channels.bindingsTab.summaryChannel": `Channel: ${values?.channel ?? ""}`,
      "channels.bindingsTab.summaryAccount": `Account: ${values?.account ?? ""}`,
      "channels.bindingsTab.summaryBindings": `Bindings in scope: ${values?.count ?? ""}`,
      "channels.bindingsTab.conflictTitle": "Binding conflicts detected",
      "channels.bindingsTab.conflictDescription": `${values?.count ?? ""} binding conflict(s) overlap this filtered scope.`,
      "channels.bindingsTab.missingBindingsTitle": "No bindings in this scope",
      "channels.bindingsTab.missingBindingsDescription":
        "This channel/account scope has no explicit bindings.",
      "channels.bindingsTab.emptyTitle": "No bindings found",
      "channels.bindingsTab.emptyDescription":
        "Use the Add Binding button to create a routing rule.",
      "common.loading": "Loading",
    };
    return table[fullKey] ?? fullKey;
  },
}));

vi.mock("@/components/shared/AgentBadge", () => ({
  AgentBadge: ({ agentId }: { agentId: string }) => <div>{agentId}</div>,
}));

vi.mock("@/components/shared/BindingDialog", () => ({
  BindingDialog: () => null,
}));

vi.mock("@/components/shared/TierBadge", () => ({
  TierBadge: ({ tier }: { tier: string }) => <div>{tier}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const selectContext = vi.hoisted(() => ({
  onValueChange: null as null | ((value: string) => void),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    onValueChange,
    children,
  }: {
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => {
    selectContext.onValueChange = onValueChange ?? null;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <button type="button" onClick={() => selectContext.onValueChange?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToRouting,
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
          { accountId: "acct-a", name: "Account A" },
          { accountId: "acct-b", name: "Account B" },
        ],
      },
    ],
  ]),
};

vi.mock("@/stores/channels", () => ({
  useChannelsStore: (selector: (state: typeof channelsState) => unknown) => selector(channelsState),
}));

const routingState = {
  bindings: [
    {
      id: "bind-1",
      agentId: "agent-a",
      tier: "account",
      match: { channel: "wecom", accountId: "acct-a" },
    },
    {
      id: "bind-2",
      agentId: "agent-b",
      tier: "account",
      match: { channel: "wecom", accountId: "acct-a" },
    },
  ],
  conflictPairs: [{ bindingA: "bind-1", bindingB: "bind-2", overlapType: "exact" }],
  configHash: "hash",
  dmScope: null,
  loading: false,
  fetchBindings: vi.fn(),
  removeBinding: vi.fn(),
};

vi.mock("@/stores/deck-routing", () => ({
  useDeckRoutingStore: (selector?: (state: typeof routingState) => unknown) =>
    selector ? selector(routingState) : routingState,
}));

let BindingsTab: typeof import("./BindingsTab").BindingsTab;

beforeEach(async () => {
  vi.resetModules();
  ({ BindingsTab } = await import("./BindingsTab"));
});

afterEach(() => {
  cleanup();
  navigateToRouting.mockReset();
  routingState.fetchBindings.mockClear();
});

describe("BindingsTab", () => {
  it("shows conflict warnings for the filtered scope", () => {
    render(<BindingsTab channelId="wecom" />);

    expect(screen.getByText("Routing Scope Summary")).toBeTruthy();
    expect(screen.getByText("Binding conflicts detected")).toBeTruthy();
    expect(screen.getByText("Bindings in scope: 2")).toBeTruthy();
  });

  it("passes channel/account context into the routing handoff and warns on empty scope", () => {
    render(<BindingsTab channelId="wecom" />);

    fireEvent.click(screen.getByRole("button", { name: "Account B" }));
    expect(screen.getByText("Account: acct-b")).toBeTruthy();
    expect(screen.getByText("No bindings in this scope")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View all routing rules" }));
    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: "acct-b",
    });
  });
});
