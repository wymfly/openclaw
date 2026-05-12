import { IconArrowL } from "../../../../design-system/icons";
import {
  PanelPill,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
  type PanelPillTone,
} from "../../../../design-system/patterns";
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

function cockpitPillTone(classTone: string): PanelPillTone {
  if (classTone === "is-positive") {
    return "positive";
  }
  if (classTone === "is-warning") {
    return "warning";
  }
  if (classTone === "is-danger") {
    return "danger";
  }
  if (classTone === "is-info") {
    return "accent";
  }
  return "default";
}

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

      <PanelSurface tone="elevated">
        <div className="hero">
          <ChannelGlyph id={channel.id} label={channel.label} />
          <PanelSectionHeader
            headingLevel={3}
            title={
              <span className="hero__title-inline">
                <span>{channel.label}</span>
                <small>{channel.id}</small>
              </span>
            }
            description={
              <>
                {channel.detailLabel || t("notAvailable")}
                {channel.meta?.pluginId ? ` / ${channel.meta.pluginId}` : ""}
                {channel.defaultAccountId ? ` / ${channel.defaultAccountId}` : ""}
              </>
            }
            meta={
              <PanelStatusRow>
                <PanelPill tone={channel.enabled ? "positive" : "default"}>
                  {channel.enabled ? t("enabled") : t("disabled")}
                </PanelPill>
                <PanelPill>{t("accountsBadge", { count: channel.accounts.length })}</PanelPill>
                <PanelPill tone={channel.alertCount > 0 ? "warning" : "positive"}>
                  {t("alertsBadge", { count: channel.alertCount })}
                </PanelPill>
                {probeResult ? (
                  <PanelPill tone={cockpitPillTone(channelProbeTone(probeResult))}>
                    {channelProbeLabel(probeResult, t)}
                  </PanelPill>
                ) : null}
                {channel.meta?.pluginOrigin ? (
                  <PanelPill>{channel.meta.pluginOrigin}</PanelPill>
                ) : null}
              </PanelStatusRow>
            }
            actions={
              <PanelStatusRow align="end">
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
              </PanelStatusRow>
            }
          />
        </div>
      </PanelSurface>

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
