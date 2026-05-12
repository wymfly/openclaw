import type { RefObject } from "react";
import { IconInfo, IconPlus, IconRefresh, IconSearch } from "../../../../design-system/icons";
import {
  KpiStrip,
  PanelMetric,
  PanelSectionHeader,
  PanelStatusRow,
} from "../../../../design-system/patterns";
import { ChannelInventoryRow } from "../parts/ChannelInventoryRow";
import type {
  ChannelFilter,
  ChannelInventoryItem,
  ChannelInventoryTotals,
  ChannelTranslator,
  PanelState,
} from "../types";

export function ChannelsListView(props: {
  items: ChannelInventoryItem[];
  filteredItems: ChannelInventoryItem[];
  totals: ChannelInventoryTotals;
  filter: ChannelFilter;
  filterCounts: Record<ChannelFilter, number>;
  availableFilters: ChannelFilter[];
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  loadState: PanelState;
  error: string;
  selectedChannelId: string | undefined;
  payloadTimestamp: number | string | undefined;
  t: ChannelTranslator;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: ChannelFilter) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onSelect: (channelId: string) => void;
}) {
  const {
    items,
    filteredItems,
    totals,
    filter,
    filterCounts,
    availableFilters,
    searchQuery,
    searchInputRef,
    loadState,
    error,
    selectedChannelId,
    payloadTimestamp,
    t,
    onSearchChange,
    onFilterChange,
    onClearFilters,
    onRefresh,
    onSelect,
  } = props;

  return (
    <main className="view list-view">
      <PanelSectionHeader
        eyebrow={t("operationsTrail")}
        title={t("title")}
        description={t("inventoryDescription")}
        actions={
          <PanelStatusRow align="end">
            <button className="btn btn--ghost" type="button" onClick={onRefresh}>
              <IconRefresh />
              {t("refreshChannels")}
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled
              title={t("createChannelUnavailable")}
            >
              <IconPlus />
              {t("newChannel")}
            </button>
          </PanelStatusRow>
        }
      />

      <KpiStrip columns={5} role="group" aria-label={t("inventoryKpis")}>
        <PanelMetric
          label={t("channelsStat")}
          value={items.length}
          hint={t("enabledCount", { count: totals.enabled })}
        />
        <PanelMetric
          label={t("accountsStat")}
          value={totals.totalAccounts}
          hint={t("acrossProviders")}
        />
        <PanelMetric
          label={t("alertsBadge", { count: totals.alerts })}
          value={totals.alerts}
          hint={t("accountsNeedingAttention")}
          tone={totals.alerts > 0 ? "warning" : "positive"}
        />
        <PanelMetric
          label={t("unhealthyStat")}
          value={totals.degraded}
          hint={t("enabledProbeFailed")}
          tone={totals.degraded > 0 ? "danger" : "positive"}
        />
        <PanelMetric
          label={t("throughput")}
          value={totals.messagesIn}
          hint={t("messagesOutSummary", { count: totals.messagesOut })}
        />
      </KpiStrip>

      <div className="toolbar">
        <label className="toolbar__search">
          <IconSearch />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchChannelsPlaceholder")}
          />
          <span className="kbd">cmd+k</span>
        </label>
        <div className="toolbar__filter" role="group" aria-label={t("filter")}>
          {availableFilters.map((entry) => (
            <button
              key={entry}
              type="button"
              className={filter === entry ? "is-active" : ""}
              onClick={() => onFilterChange(entry)}
            >
              {t(`filter_${entry}`)} {filterCounts[entry]}
            </button>
          ))}
        </div>
      </div>

      <div className="row__head" role="row">
        <div />
        <div>{t("channelColumn")}</div>
        <div>{t("throughput")}</div>
        <div>{t("probeColumn")}</div>
        <div>{t("accountsStat")}</div>
        <div>{t("statusColumn")}</div>
      </div>

      {loadState === "loading" && (
        <div className="empty">
          <span className="spinner" />
          {t("loadingChannels")}
        </div>
      )}
      {error && loadState !== "loading" ? (
        <div className="empty">
          <strong>{t("loadChannelsFailed")}</strong>
          <span>{error}</span>
          <button className="btn btn--sm" type="button" onClick={onRefresh}>
            {t("refreshChannels")}
          </button>
        </div>
      ) : null}
      {loadState !== "loading" && items.length === 0 ? (
        <div className="empty">
          <IconInfo />
          <strong>{t("noChannelsLoaded")}</strong>
          <span>{t("noChannelsLoadedDescription")}</span>
        </div>
      ) : null}
      {loadState !== "loading" && items.length > 0 && filteredItems.length === 0 ? (
        <div className="empty">
          <strong>{t("noFilteredChannels")}</strong>
          <span>{t("noFilteredChannelsDescription")}</span>
          <span>
            {[
              searchQuery.trim() ? t("criteriaSearch", { value: searchQuery.trim() }) : "",
              filter !== "all" ? t("criteriaFilter", { value: t(`filter_${filter}`) }) : "",
            ]
              .filter(Boolean)
              .join(" | ")}
          </span>
          <button className="btn btn--sm" type="button" onClick={onClearFilters}>
            {t("clearFilters")}
          </button>
        </div>
      ) : null}

      {filteredItems.length > 0 ? (
        <div className="channels-list" role="list">
          {filteredItems.map((item) => (
            <ChannelInventoryRow
              key={item.id}
              item={item}
              selected={selectedChannelId === item.id}
              totalMessagesIn={totals.messagesIn}
              t={t}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      <footer className="view__footer">
        <span>{t("filteredCount", { shown: filteredItems.length, total: items.length })}</span>
        <span>{t("timestampValue", { value: payloadTimestamp ?? t("notAvailable") })}</span>
      </footer>
    </main>
  );
}
