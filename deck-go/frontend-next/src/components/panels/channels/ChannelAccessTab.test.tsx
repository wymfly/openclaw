// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelInfo } from "../../../stores/channels";
import { ChannelAccessTab } from "./ChannelAccessTab";

const { navigateToRouting, useChannelsStoreMock, useDeckRoutingStoreMock } = vi.hoisted(() => {
  const storeState = {} as Record<string, unknown>;
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
  const routingState = {} as Record<string, unknown>;
  const useDeckRoutingStoreMock = ((selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector(routingState) : routingState) as ((
    selector?: (state: Record<string, unknown>) => unknown,
  ) => unknown) & {
    setState: (next: Record<string, unknown>) => void;
  };
  useDeckRoutingStoreMock.setState = (next) => {
    for (const key of Object.keys(routingState)) {
      delete routingState[key];
    }
    Object.assign(routingState, next);
  };
  return {
    navigateToRouting: vi.fn(),
    useChannelsStoreMock,
    useDeckRoutingStoreMock,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) => {
    const tables: Record<string, Record<string, string>> = {
      common: {
        loading: "Loading",
        save: "Save",
        saving: "Saving",
      },
      "channels.settings": {
        "dmPolicy.title": "DM Policy",
        "dmPolicy.pairing": "Pairing",
        "dmPolicy.pairingDesc": "Pairing desc",
        "dmPolicy.allowlist": "Allowlist",
        "dmPolicy.allowlistDesc": "Allowlist desc",
        "dmPolicy.open": "Open",
        "dmPolicy.openDesc": "Open desc",
        "dmPolicy.disabled": "Disabled",
        "dmPolicy.disabledDesc": "Disabled desc",
        "dmPolicy.recommended": "Recommended",
      },
      "channels.access": {
        title: "WeCom Access Controls",
        description: "Manage access",
        unsupportedTitle: "Unsupported",
        unsupportedDescription: "Unsupported description",
        accountSelector: "Account",
        allAccountsTitle: "All Accounts",
        allAccountsDescription: "Compare all accounts",
        botSection: `Bot DM Policy · ${values?.account ?? ""}`,
        botDescription: "Bot description",
        agentSection: `Agent DM Policy · ${values?.account ?? ""}`,
        agentDescription: "Agent description",
        allowlistEmpty: "Allowlist empty",
        allowFromHint: "hint",
        allowFromPlaceholder: "Add a WeCom user id or *",
        noModes: "No modes",
        dynamicAgentsTitle: "Dynamic Agents",
        dynamicAgentsDescription: "Dynamic description",
        dynamicAgentsMissingAdmins: "Missing admins",
        dynamicAgentsMissingRouting: `No routing bindings match ${values?.account ?? ""} yet.`,
        dynamicAgentsEnabled: "Enable dynamic",
        dynamicAgentsDm: "DM dynamic",
        dynamicAgentsGroup: "Group dynamic",
        adminUsersHint: "admin hint",
        adminUsersPlaceholder: "Add an admin user id",
        routingTitle: "Routing Behavior",
        routingDescription: "Routing description",
        failClosedLabel: "Reject unmatched",
        openRouting: "Open Routing Panel",
        routingSummary: "Use routing panel",
        "table.account": "Account",
        "table.bot": "Bot",
        "table.agent": "Agent",
        "table.dynamicAgents": "Dynamic Agents",
        "table.notConfigured": "Not configured",
        "table.enabled": "Enabled",
        "table.disabled": "Disabled",
      },
      "channels.access.allowFromEditor": {
        count: `${values?.count ?? 0} entries`,
        placeholder: "Add an entry",
        add: "Add",
        empty: "No entries configured.",
        bulkTitle: "Bulk Import",
        bulkPlaceholder: "Paste entries",
        bulkApply: "Apply",
        invalid: `Invalid entry: ${values?.entry ?? ""}`,
        remove: `Remove ${values?.entry ?? ""}`,
      },
    };
    return tables[ns]?.[key] ?? key;
  },
}));

vi.mock("../../../stores/channels", () => ({
  useChannelsStore: useChannelsStoreMock,
}));

vi.mock("../../../stores/deck-routing", () => ({
  useDeckRoutingStore: useDeckRoutingStoreMock,
}));

vi.mock("../../../lib/panel-navigation", () => ({
  navigateToRouting,
}));

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
      <select
        aria-label="Account"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useDeckRoutingStoreMock.setState({
    bindings: [],
    fetchBindings: vi.fn(async () => {}),
  });
});

function buildChannel(accounts?: ChannelInfo["accounts"]): ChannelInfo {
  return {
    id: "wecom",
    label: "WeCom",
    accounts: accounts ?? [
      {
        accountId: "default",
        name: "Default",
        enabled: true,
        configured: true,
        linked: true,
        connected: true,
      },
    ],
    defaultAccountId: "default",
  };
}

describe("ChannelAccessTab", () => {
  it("renders WeCom access controls, preserves routing context, and saves bot allowFrom", async () => {
    const saveChannelConfig = vi.fn(async () => true);
    useChannelsStoreMock.setState({
      channelConfig: {
        bot: { dm: { policy: "allowlist", allowFrom: [] } },
        agent: { dm: { policy: "open", allowFrom: ["user-a"] } },
        dynamicAgents: { enabled: true, dmCreateAgent: true, groupEnabled: true, adminUsers: [] },
        routing: { failClosedOnDefaultRoute: true },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig,
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    });

    render(<ChannelAccessTab channelId="wecom" channel={buildChannel()} />);

    expect(await screen.findByText("WeCom Access Controls")).toBeTruthy();
    expect(screen.getAllByText("Allowlist empty").length).toBeGreaterThan(0);
    expect(screen.getByText("Dynamic Agents")).toBeTruthy();
    expect(screen.getByText("Missing admins")).toBeTruthy();
    expect(screen.getByText("Bot DM Policy · Default")).toBeTruthy();
    expect(screen.getByText("Agent DM Policy · Default")).toBeTruthy();

    fireEvent.click(screen.getByText("Open Routing Panel"));
    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: "default",
    });

    fireEvent.change(screen.getByPlaceholderText("Add a WeCom user id or *"), {
      target: { value: "user:test-user" },
    });
    fireEvent.click(screen.getAllByText("Add")[0]);
    fireEvent.click(screen.getAllByText("Save")[0]);
    expect(saveChannelConfig).toHaveBeenCalledWith("wecom", {
      bot: { dm: { policy: "allowlist", allowFrom: ["test-user"] } },
    });
  });

  it("saves multi-account edits to the selected account branch even before explicit matrix config exists", async () => {
    const saveChannelConfig = vi.fn(async () => true);
    useChannelsStoreMock.setState({
      channelConfig: {
        bot: { dm: { policy: "pairing", allowFrom: [] } },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig,
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    });

    render(
      <ChannelAccessTab
        channelId="wecom"
        channel={buildChannel([
          {
            accountId: "default",
            name: "Default",
            enabled: true,
            configured: true,
            linked: true,
            connected: true,
          },
          {
            accountId: "tenant-b",
            name: "Tenant B",
            enabled: true,
            configured: true,
            linked: true,
            connected: true,
          },
        ])}
      />,
    );

    expect(await screen.findByLabelText("Account")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Account"), {
      target: { value: "tenant-b" },
    });
    fireEvent.click(screen.getByText("Allowlist"));

    const addEntryInputs = screen.getAllByPlaceholderText("Add a WeCom user id or *");
    fireEvent.change(addEntryInputs[0], { target: { value: "tenant-user" } });
    fireEvent.click(screen.getAllByText("Add")[0]);
    fireEvent.click(screen.getAllByText("Save")[0]);

    expect(saveChannelConfig).toHaveBeenCalledWith("wecom", {
      accounts: {
        "tenant-b": {
          bot: { dm: { policy: "allowlist", allowFrom: ["tenant-user"] } },
        },
      },
    });
  });

  it("shows an all-accounts comparison table for multi-account WeCom setups", async () => {
    useChannelsStoreMock.setState({
      channelConfig: {
        accounts: {
          default: {
            bot: { dm: { policy: "pairing", allowFrom: [] } },
          },
          "tenant-b": {
            agent: { dm: { policy: "open", allowFrom: ["user-b"] } },
          },
        },
        dynamicAgents: { enabled: true, dmCreateAgent: true, groupEnabled: true, adminUsers: [] },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig: vi.fn(async () => true),
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    });

    render(
      <ChannelAccessTab
        channelId="wecom"
        channel={buildChannel([
          {
            accountId: "default",
            name: "Default",
            enabled: true,
            configured: true,
            linked: true,
            connected: true,
          },
          {
            accountId: "tenant-b",
            name: "Tenant B",
            enabled: true,
            configured: true,
            linked: true,
            connected: true,
          },
        ])}
      />,
    );

    expect(await screen.findByText("All Accounts")).toBeTruthy();
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tenant B").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enabled").length).toBeGreaterThan(0);
  });

  it("warns when dynamic agents are enabled without matching routing context", async () => {
    useChannelsStoreMock.setState({
      channelConfig: {
        bot: { dm: { policy: "pairing", allowFrom: [] } },
        dynamicAgents: {
          enabled: true,
          dmCreateAgent: true,
          groupEnabled: true,
          adminUsers: ["admin"],
        },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig: vi.fn(async () => true),
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    });

    render(<ChannelAccessTab channelId="wecom" channel={buildChannel()} />);

    expect(await screen.findByText("Dynamic Agents")).toBeTruthy();
    expect(screen.getByText("No routing bindings match Default yet.")).toBeTruthy();
  });

  it("suppresses the dynamic-agent routing warning when a matching binding exists", async () => {
    useChannelsStoreMock.setState({
      channelConfig: {
        bot: { dm: { policy: "pairing", allowFrom: [] } },
        dynamicAgents: {
          enabled: true,
          dmCreateAgent: true,
          groupEnabled: true,
          adminUsers: ["admin"],
        },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig: vi.fn(async () => true),
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [
        {
          id: "bind-1",
          agentId: "agent-1",
          match: { channel: "wecom", accountId: "default" },
        },
      ],
      fetchBindings: vi.fn(async () => {}),
    });

    render(<ChannelAccessTab channelId="wecom" channel={buildChannel()} />);

    expect(await screen.findByText("Dynamic Agents")).toBeTruthy();
    expect(screen.queryByText("No routing bindings match Default yet.")).toBeNull();
  });

  it("saves dynamic agents and routing fail-closed behavior from the dedicated sections", async () => {
    const saveChannelConfig = vi.fn(async () => true);
    useChannelsStoreMock.setState({
      channelConfig: {
        bot: { dm: { policy: "pairing", allowFrom: [] } },
        dynamicAgents: {
          enabled: false,
          dmCreateAgent: false,
          groupEnabled: false,
          adminUsers: [],
        },
        routing: { failClosedOnDefaultRoute: false },
      },
      fetchChannelConfig: vi.fn(async () => {}),
      saveChannelConfig,
      channelConfigSaveError: null,
      fetchChannels: vi.fn(async () => {}),
    });
    useDeckRoutingStoreMock.setState({
      bindings: [],
      fetchBindings: vi.fn(async () => {}),
    });

    render(<ChannelAccessTab channelId="wecom" channel={buildChannel()} />);
    await screen.findByText("Dynamic Agents");

    fireEvent.click(screen.getByText("Enable dynamic"));
    fireEvent.click(screen.getByText("DM dynamic"));
    fireEvent.click(screen.getByText("Group dynamic"));
    fireEvent.change(screen.getByPlaceholderText("Add an admin user id"), {
      target: { value: "Admin-One" },
    });
    fireEvent.click(screen.getAllByText("Add")[0]);

    const dynamicCard = screen
      .getByText("Dynamic Agents")
      .closest("div.rounded-lg.border.px-4.py-3");
    expect(dynamicCard).toBeTruthy();
    fireEvent.click(within(dynamicCard as HTMLElement).getByText("Save"));
    expect(saveChannelConfig).toHaveBeenCalledWith("wecom", {
      dynamicAgents: {
        enabled: true,
        dmCreateAgent: true,
        groupEnabled: true,
        adminUsers: ["admin-one"],
      },
    });

    const routingCard = screen
      .getByText("Routing Behavior")
      .closest("div.rounded-lg.border.px-4.py-3");
    expect(routingCard).toBeTruthy();
    fireEvent.click(within(routingCard as HTMLElement).getByRole("checkbox"));
    fireEvent.click(within(routingCard as HTMLElement).getByText("Save"));
    expect(saveChannelConfig).toHaveBeenCalledWith("wecom", {
      routing: { failClosedOnDefaultRoute: true },
    });
  });
});
