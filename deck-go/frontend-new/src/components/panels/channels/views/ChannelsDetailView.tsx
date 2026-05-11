import { IconArrowL } from "../../../../design-system/icons";
import { JsonDetails } from "../../../shared/ShellComponents";
import { channelProbeLabel, channelProbeTone } from "../lib/channel-selectors";
import { ChannelGlyph } from "../parts/ChannelGlyph";
import type {
  ChannelActionState,
  ChannelInventoryItem,
  ChannelTabDescriptor,
  ChannelTabId,
  ChannelTranslator,
  DeckGoChannelTestResponse,
} from "../types";

export function ChannelsDetailView(props: {
  channel: ChannelInventoryItem;
  availableTabs: ChannelTabDescriptor[];
  selectedTab: ChannelTabId;
  probeResult: DeckGoChannelTestResponse | null;
  actionState: ChannelActionState;
  error: string;
  payloadTimestamp: number | string | undefined;
  actionResult: unknown;
  t: ChannelTranslator;
  onTabChange: (tab: ChannelTabId) => void;
  onBack: () => void;
  onRunProbe: () => void;
  onRequestLogout: () => void;
  children?: React.ReactNode;
}) {
  const {
    channel,
    availableTabs,
    selectedTab,
    probeResult,
    actionState,
    error,
    payloadTimestamp,
    actionResult,
    t,
    onTabChange,
    onBack,
    onRunProbe,
    onRequestLogout,
    children,
  } = props;

  return (
    <main className="view detail-view">
      <div className="detail__head">
        <button className="btn btn--ghost detail__back" type="button" onClick={onBack}>
          <IconArrowL />
          {t("backToChannels")}
        </button>
        <span className="detail__back-trail">/ {channel.label}</span>
      </div>

      <header className="hero">
        <ChannelGlyph id={channel.id} label={channel.label} />
        <div>
          <h1 className="hero__title">
            {channel.label}
            <small>{channel.id}</small>
          </h1>
          <p className="hero__sub">
            {channel.detailLabel || t("notAvailable")}
            {channel.meta?.pluginId ? ` / ${channel.meta.pluginId}` : ""}
            {channel.defaultAccountId ? ` / ${channel.defaultAccountId}` : ""}
          </p>
          <div className="hero__meta">
            <span className={`deckgo-pill ${channel.enabled ? "is-positive" : "is-muted"}`}>
              {channel.enabled ? t("enabled") : t("disabled")}
            </span>
            <span className="deckgo-pill">
              {t("accountsBadge", { count: channel.accounts.length })}
            </span>
            <span
              className={`deckgo-pill ${channel.alertCount > 0 ? "is-warning" : "is-positive"}`}
            >
              {t("alertsBadge", { count: channel.alertCount })}
            </span>
            {probeResult ? (
              <span className={`deckgo-pill ${channelProbeTone(probeResult)}`}>
                {channelProbeLabel(probeResult, t)}
              </span>
            ) : null}
            {channel.meta?.pluginOrigin ? (
              <span className="deckgo-pill">{channel.meta.pluginOrigin}</span>
            ) : null}
          </div>
        </div>
        <div className="hero__actions">
          <button
            className="btn"
            type="button"
            disabled={actionState !== "idle"}
            onClick={onRunProbe}
          >
            {actionState === "testing" ? t("testingChannel") : t("testChannel")}
          </button>
          <button
            className="btn btn--danger"
            type="button"
            disabled={!channel.enabled || actionState !== "idle"}
            onClick={onRequestLogout}
          >
            {actionState === "logging-out" ? t("loggingOut") : t("logoutChannel")}
          </button>
        </div>
      </header>

      {error ? <p className="deckgo-note deck-ui-channels-error">{error}</p> : null}

      <nav className="tabs" role="tablist" aria-label={t("channelTabs")}>
        {availableTabs.map((tab) => (
          <button
            aria-selected={selectedTab === tab.id}
            className={`tab ${selectedTab === tab.id ? "is-active" : ""}`}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            {t(`tab_${tab.id}`)}
            {tab.id === "routing" ? (
              <span className="tab__count">{channel.defaultAccountId ? 1 : 0}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <section className="detail__body">{children}</section>

      <footer className="view__footer">
        <span>{t("timestampValue", { value: payloadTimestamp ?? t("notAvailable") })}</span>
        <span>{t("describeDriftNote")}</span>
      </footer>
      <JsonDetails title={t("channelMetadata")} payload={channel.meta ?? null} />
      <JsonDetails title={t("channelPayload")} payload={channel.channel} />
      <JsonDetails title={t("channelTestResult")} payload={probeResult} />
      <JsonDetails title={t("logoutResult")} payload={actionResult} />
    </main>
  );
}
