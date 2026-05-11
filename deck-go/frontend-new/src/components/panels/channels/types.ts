import type {
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse,
  DeckGoChannelsStatusResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingListResponse,
} from "../../../api";
import type { useTranslations } from "../../../i18n/provider";

export type PanelState = "idle" | "loading" | "ready";
export type ChannelDiagnosticTone = "success" | "warning" | "error" | "neutral" | "info";
export type ThroughputWindow = "1h" | "6h" | "24h";
export type ChannelsView = "list" | "detail";
export type ChannelFilter = "all" | "enabled" | "alerts" | "wecom";
export type ChannelTabId = "overview" | "throughput" | "probe" | "settings" | "routing" | "wecom";
export type ChannelActionState = "idle" | "logging-out" | "testing" | "toggling";

export type ChannelUiMeta = NonNullable<DeckGoChannelsStatusResponse["channelMeta"]>[number];
export type ChannelTranslator = ReturnType<typeof useTranslations>;

export type NormalizedChannelAccount = {
  accountId: string;
  payload: Record<string, unknown>;
  diagnostic: {
    tone: ChannelDiagnosticTone;
    title: string;
    description: string;
    nextStep: string;
  };
};

export type ChannelInventoryItem = {
  accounts: NormalizedChannelAccount[];
  alertCount: number;
  channel: Record<string, unknown>;
  defaultAccountId: string;
  detailLabel: string;
  enabled: boolean;
  id: string;
  label: string;
  meta?: ChannelUiMeta;
  throughputSummary: {
    messagesIn: number;
    messagesOut: number;
  };
};

export type ChannelTabDescriptor = { id: ChannelTabId; wecomOnly?: boolean };

export type ChannelNavigationTarget = {
  accountId: string;
  channelId: string;
  section: "" | "access";
};

export type ChannelInventoryTotals = {
  alerts: number;
  degraded: number;
  enabled: number;
  messagesIn: number;
  messagesOut: number;
  totalAccounts: number;
};

export const THROUGHPUT_WINDOWS: ThroughputWindow[] = ["1h", "6h", "24h"];
export const FILTERS: ChannelFilter[] = ["all", "enabled", "alerts", "wecom"];
export const CHANNEL_TABS: ChannelTabDescriptor[] = [
  { id: "overview" },
  { id: "throughput" },
  { id: "probe" },
  { id: "settings" },
  { id: "routing" },
  { id: "wecom", wecomOnly: true },
];

export type {
  DeckGoChannelTestResponse,
  DeckGoChannelThroughputBucket,
  DeckGoChannelThroughputResponse,
  DeckGoChannelsStatusResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingListResponse,
};
