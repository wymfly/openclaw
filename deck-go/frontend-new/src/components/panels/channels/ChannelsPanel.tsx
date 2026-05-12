import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  channelThroughputQueryOptions,
  channelsListQueryOptions,
  useLogoutChannelMutation,
  usePatchChannelConfigMutation,
  useTestChannelMutation,
} from "../../../data/modules/channels";
import { routingBindingsQueryOptions } from "../../../data/modules/routing";
import { navigateToPlugin, navigateToRouting } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { PanelRoot } from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";
import { LogoutDialog } from "./dialogs/LogoutDialog";
import { TestResultDialog } from "./dialogs/TestResultDialog";
import {
  applyChannelFilter,
  buildChannelInventory,
  hasWecomChannel,
  numberValue,
  readChannelNavigationTarget,
  summarizeInventoryTotals,
} from "./lib/channel-selectors";
import { TabOverview } from "./tabs/TabOverview";
import { TabProbe } from "./tabs/TabProbe";
import { TabRouting } from "./tabs/TabRouting";
import { TabSettings } from "./tabs/TabSettings";
import { TabThroughput } from "./tabs/TabThroughput";
import { TabWeComAccess } from "./tabs/TabWeComAccess";
import {
  CHANNEL_TABS,
  FILTERS,
  type ChannelActionState,
  type ChannelFilter,
  type ChannelTabId,
  type ChannelsView,
  type DeckGoChannelTestResponse,
  type DeckGoChannelThroughputResponse,
  type DeckGoChannelsStatusResponse,
  type DeckGoRoutingListResponse,
  type PanelState,
  type ThroughputWindow,
} from "./types";
import { ChannelsDetailView } from "./views/ChannelsDetailView";
import { ChannelsListView } from "./views/ChannelsListView";
import type { WecomAccessAccount } from "./WecomAccessControls";
import "./channels-panel.css";

export function ChannelsPanel() {
  const t = useTranslations("channels");
  const ui = useDeckUI();
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const testChannelMutation = useTestChannelMutation();
  const logoutChannelMutation = useLogoutChannelMutation();
  const patchChannelConfigMutation = usePatchChannelConfigMutation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [navigationTarget] = useState(readChannelNavigationTarget);
  const [payload, setPayload] = useState<DeckGoChannelsStatusResponse | null>(null);
  const [throughput, setThroughput] = useState<DeckGoChannelThroughputResponse | null>(null);
  const [throughputWindow, setThroughputWindow] = useState<ThroughputWindow>("1h");
  const [channelTestResult, setChannelTestResult] = useState<DeckGoChannelTestResponse | null>(
    null,
  );
  const [configPatchResult, setConfigPatchResult] = useState<unknown>(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [view, setView] = useState<ChannelsView>("list");
  const [activeTab, setActiveTab] = useState<ChannelTabId>(
    navigationTarget.section === "access" ? "wecom" : "overview",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [, setThroughputState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<ChannelActionState>("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [testResultDialogOpen, setTestResultDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [routing, setRouting] = useState<DeckGoRoutingListResponse | null>(null);
  const [routingState, setRoutingState] = useState<PanelState>("idle");
  const [routingError, setRoutingError] = useState("");

  const channelItems = useMemo(() => buildChannelInventory(payload, t), [payload, t]);
  const totals = useMemo(() => summarizeInventoryTotals(channelItems), [channelItems]);
  const filterCounts = useMemo<Record<ChannelFilter, number>>(
    () => ({
      alerts: applyChannelFilter(channelItems, "alerts", "").length,
      all: channelItems.length,
      enabled: applyChannelFilter(channelItems, "enabled", "").length,
      wecom: applyChannelFilter(channelItems, "wecom", "").length,
    }),
    [channelItems],
  );
  const availableFilters = useMemo(
    () => FILTERS.filter((entry) => entry !== "wecom" || hasWecomChannel(channelItems)),
    [channelItems],
  );
  const filteredItems = useMemo(
    () => applyChannelFilter(channelItems, filter, searchQuery),
    [channelItems, filter, searchQuery],
  );

  const selectedItem =
    channelItems.find((item) => item.id === selectedChannelId) ?? channelItems[0] ?? null;
  const selectedIsWecomAccessChannel =
    selectedItem?.id === "wecom" || selectedItem?.meta?.pluginId === "wecom";
  const availableTabs = CHANNEL_TABS.filter(
    (tab) => !tab.wecomOnly || selectedIsWecomAccessChannel,
  );
  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";
  const selectedProbeResult =
    channelTestResult?.channelId === selectedItem?.id ? channelTestResult : null;
  const selectedChannelLatency = selectedItem
    ? (numberValue(selectedItem.channel, "latencyMs") ?? selectedProbeResult?.latencyMs)
    : undefined;
  const selectedAccessAccounts: WecomAccessAccount[] =
    selectedItem?.accounts.map((account) => ({
      accountId: account.accountId,
      label:
        typeof account.payload.displayName === "string"
          ? account.payload.displayName
          : typeof account.payload.name === "string"
            ? account.payload.name
            : account.accountId,
    })) ?? [];
  const throughputBuckets = Array.isArray(throughput?.buckets) ? throughput.buckets : [];
  const throughputMessagesIn = throughput?.messagesIn ?? 0;
  const throughputMessagesOut = throughput?.messagesOut ?? 0;

  const refresh = async (preferredChannelId?: string) => {
    setLoadState("loading");
    try {
      const next = await queryClient.fetchQuery({
        ...channelsListQueryOptions(bff),
        staleTime: 0,
      });
      setPayload(next);
      setLoadState("ready");
      setError("");
      const order = next.channelOrder?.length
        ? next.channelOrder
        : Object.keys(next.channels ?? {});
      const preferred =
        preferredChannelId?.trim() || navigationTarget.channelId || selectedChannelId || "";
      const nextSelected =
        preferred && order.includes(preferred)
          ? preferred
          : order.includes(selectedChannelId)
            ? selectedChannelId
            : order[0] || "";
      setSelectedChannelId(nextSelected);
      if (nextSelected && (navigationTarget.channelId || preferredChannelId)) {
        setView("detail");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadChannelsFailed"));
    }
  };

  useEffect(() => {
    void refresh(navigationTarget.channelId);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setView("list");
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape" && view === "detail") {
        event.preventDefault();
        setView("list");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [view]);

  useEffect(() => {
    if (!selectedChannelId) {
      setThroughput(null);
      setThroughputState("idle");
      return undefined;
    }
    let mounted = true;
    setThroughputState("loading");
    void queryClient
      .fetchQuery(channelThroughputQueryOptions(bff, selectedChannelId, throughputWindow))
      .then((next) => {
        if (!mounted) {
          return;
        }
        setThroughput(next);
        setThroughputState("ready");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setThroughput(null);
        setThroughputState("idle");
        setError(loadError instanceof Error ? loadError.message : t("throughputFetchFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [bff, queryClient, selectedChannelId, throughputWindow, t]);

  useEffect(() => {
    if (!availableFilters.includes(filter)) {
      setFilter("all");
    }
  }, [availableFilters, filter]);

  useEffect(() => {
    if (selectedTab !== "routing" || !selectedItem) {
      return undefined;
    }
    let mounted = true;
    setRoutingState("loading");
    void queryClient
      .fetchQuery(
        routingBindingsQueryOptions(bff, {
          channel: selectedItem.id,
          accountId: selectedItem.defaultAccountId,
        }),
      )
      .then((next) => {
        if (!mounted) {
          return;
        }
        setRouting(next);
        setRoutingError("");
        setRoutingState("ready");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setRouting(null);
        setRoutingError(
          loadError instanceof Error ? loadError.message : t("routingBindingsFetchFailed"),
        );
        setRoutingState("idle");
      });
    return () => {
      mounted = false;
    };
  }, [
    bff,
    queryClient,
    selectedTab,
    selectedItem?.id,
    selectedItem?.defaultAccountId,
    selectedItem,
    t,
  ]);

  const openDetail = (channelId: string, tab: ChannelTabId = "overview") => {
    setSelectedChannelId(channelId);
    setActiveTab(tab);
    setError("");
    setView("detail");
  };

  const runLogout = async () => {
    if (!selectedItem) {
      return;
    }
    setLogoutDialogOpen(false);
    setActionState("logging-out");
    try {
      const result = await logoutChannelMutation.mutateAsync(selectedItem.id);
      setActionResult(result);
      setError("");
      await refresh(selectedItem.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("logoutFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const runChannelTest = async () => {
    if (!selectedItem) {
      return;
    }
    setActionState("testing");
    try {
      const result = await testChannelMutation.mutateAsync(selectedItem.id);
      setChannelTestResult({ ...result, channelId: result.channelId || selectedItem.id });
      setTestResultDialogOpen(true);
      setActiveTab("probe");
      setError(result.ok === false ? result.error || t("testFailed") : "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("testFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const toggleSelectedChannel = async () => {
    if (!selectedItem) {
      return;
    }
    const nextEnabled = !selectedItem.enabled;
    if (
      !window.confirm(
        t("confirmSetChannelEnabled", {
          channelId: selectedItem.id,
          value: String(nextEnabled),
        }),
      )
    ) {
      return;
    }
    setActionState("toggling");
    try {
      const result = await patchChannelConfigMutation.mutateAsync({
        channelId: selectedItem.id,
        patch: { enabled: nextEnabled },
      });
      setConfigPatchResult(result);
      setError("");
      await refresh(selectedItem.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("configPatchFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const handleEditorSaved = async (result: Record<string, unknown>) => {
    setConfigPatchResult(result);
    if (selectedItem) {
      await refresh(selectedItem.id);
    }
  };

  const renderTabBody = () => {
    if (!selectedItem) {
      return null;
    }
    if (selectedTab === "throughput") {
      return (
        <TabThroughput
          buckets={throughputBuckets}
          messagesIn={throughputMessagesIn}
          messagesOut={throughputMessagesOut}
          window={throughputWindow}
          t={t}
          onWindowChange={setThroughputWindow}
        />
      );
    }
    if (selectedTab === "probe") {
      return (
        <TabProbe
          channel={selectedItem}
          probeResult={selectedProbeResult}
          actionState={actionState}
          t={t}
          onRunProbe={() => void runChannelTest()}
        />
      );
    }
    if (selectedTab === "settings") {
      return (
        <TabSettings
          channel={selectedItem}
          actionState={actionState}
          isWecomAccessChannel={selectedIsWecomAccessChannel}
          configPatchResult={configPatchResult}
          t={t}
          onToggleEnabled={() => void toggleSelectedChannel()}
          onSettingsSaved={handleEditorSaved}
          onAccountPolicySaved={handleEditorSaved}
        />
      );
    }
    if (selectedTab === "routing") {
      return (
        <TabRouting
          channelId={selectedItem.id}
          accountId={selectedItem.defaultAccountId}
          routing={routing}
          loadState={routingState}
          error={routingError}
          t={t}
          onOpenRouting={(params) => navigateToRouting(ui, params)}
        />
      );
    }
    if (selectedTab === "wecom" && selectedIsWecomAccessChannel) {
      return (
        <TabWeComAccess
          channel={selectedItem}
          accessAccounts={selectedAccessAccounts}
          initialAccountId={navigationTarget.accountId}
          initialFocus={navigationTarget.section === "access" ? "access" : undefined}
          onSaved={() => refresh(selectedItem.id)}
        />
      );
    }
    return (
      <TabOverview
        channel={selectedItem}
        probeResult={selectedProbeResult}
        channelLatencyMs={selectedChannelLatency}
        throughputMessagesIn={throughputMessagesIn}
        throughputMessagesOut={throughputMessagesOut}
        throughputWindow={throughputWindow}
        pluginId={selectedItem.meta?.pluginId}
        t={t}
        onOpenPlugin={(pluginId) => navigateToPlugin(ui, pluginId)}
        onSwitchTab={setActiveTab}
      />
    );
  };

  return (
    <PanelRoot data-testid="channels-panel" density="compact">
      <div className="channels-panel">
        {view === "detail" && selectedItem ? (
          <ChannelsDetailView
            channel={selectedItem}
            availableTabs={availableTabs}
            selectedTab={selectedTab}
            probeResult={selectedProbeResult}
            actionState={actionState}
            error={error}
            payloadTimestamp={payload?.ts}
            actionResult={actionResult}
            t={t}
            onTabChange={setActiveTab}
            onBack={() => setView("list")}
            onRunProbe={() => void runChannelTest()}
            onRequestLogout={() => setLogoutDialogOpen(true)}
          >
            {renderTabBody()}
          </ChannelsDetailView>
        ) : (
          <ChannelsListView
            items={channelItems}
            filteredItems={filteredItems}
            totals={totals}
            filter={filter}
            filterCounts={filterCounts}
            availableFilters={availableFilters}
            searchQuery={searchQuery}
            searchInputRef={searchRef}
            loadState={loadState}
            error={error}
            selectedChannelId={selectedItem?.id}
            payloadTimestamp={payload?.ts}
            t={t}
            onSearchChange={setSearchQuery}
            onFilterChange={setFilter}
            onClearFilters={() => {
              setSearchQuery("");
              setFilter("all");
            }}
            onRefresh={() => void refresh(selectedItem?.id)}
            onSelect={(channelId) => openDetail(channelId)}
          />
        )}
        {testResultDialogOpen && selectedProbeResult ? (
          <TestResultDialog
            channelLabel={selectedItem?.label ?? selectedProbeResult.channelId}
            result={selectedProbeResult}
            t={t}
            onClose={() => setTestResultDialogOpen(false)}
          />
        ) : null}
        {logoutDialogOpen && selectedItem ? (
          <LogoutDialog
            channelId={selectedItem.id}
            actionState={actionState}
            t={t}
            onCancel={() => setLogoutDialogOpen(false)}
            onConfirm={() => void runLogout()}
          />
        ) : null}
      </div>
    </PanelRoot>
  );
}
