import { IconAlert, IconCheck } from "../../../../design-system/icons";
import { formatThroughputSummary, throughputSparkClass } from "../lib/channel-selectors";
import type { ChannelInventoryItem, ChannelTranslator } from "../types";
import { ChannelGlyph } from "./ChannelGlyph";

export function ChannelInventoryRow(props: {
  item: ChannelInventoryItem;
  selected: boolean;
  totalMessagesIn: number;
  t: ChannelTranslator;
  onSelect: (channelId: string) => void;
}) {
  const { item, selected, totalMessagesIn, t, onSelect } = props;
  return (
    <button
      className={`row deck-ui-channels-row ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={() => onSelect(item.id)}
    >
      <ChannelGlyph id={item.id} label={item.label} />
      <span className="row__id">
        <strong>{item.label}</strong>
        <small>{item.detailLabel || item.meta?.pluginId || item.id}</small>
      </span>
      <span className="row__throughput">
        <span
          className={`row__spark ${throughputSparkClass(item.throughputSummary, totalMessagesIn)}`}
          aria-hidden="true"
        >
          <span />
        </span>
        <small>{formatThroughputSummary(item.throughputSummary, t)}</small>
      </span>
      <span className="row__probe">
        {!item.enabled ? (
          <span className="deckgo-pill is-muted">{t("disabled")}</span>
        ) : item.alertCount > 0 ? (
          <span className="deckgo-pill is-warning">
            <IconAlert />
            {t("alertsBadge", { count: item.alertCount })}
          </span>
        ) : (
          <span className="deckgo-pill is-positive">
            <IconCheck />
            {t("diagHealthyTitle")}
          </span>
        )}
      </span>
      <span className="row__num">{item.accounts.length}</span>
      <span>
        <span className={`deckgo-pill ${item.enabled ? "is-positive" : "is-muted"}`}>
          {item.enabled ? t("enabled") : t("disabled")}
        </span>
      </span>
    </button>
  );
}
