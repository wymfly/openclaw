import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeckGoAgentIdentityResponse,
  DeckGoIdentityLink,
  DeckGoIdentityPeer,
} from "../../../api-types";
import { useAgentIdentityQuery } from "../../../data/modules/agents";
import {
  useIdentityLinksQuery,
  useLinkIdentityPeerMutation,
  useUnlinkIdentityPeerMutation,
} from "../../../data/modules/identity";
import {
  IconAlert,
  IconClock,
  IconEdit,
  IconHash,
  IconLink,
  IconRefresh,
  IconShield,
  IconTrash,
  IconUnlink,
} from "../../../design-system/icons";
import {
  KpiStrip,
  PanelMetric,
  PanelPill,
  PanelRoot,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
} from "../../../design-system/patterns";
import { useTranslations } from "../../../i18n/provider";
import { IdentityList } from "./IdentityList";
import { LinkDialog, type IdentityLinkInput } from "./LinkDialog";
import "./identity-panel.css";

type PanelState = "idle" | "loading" | "ready";

function peerKey(canonical: string, peer: DeckGoIdentityPeer) {
  return `${canonical}:${peer.channel}:${peer.peerId}`;
}

function channelMix(links: DeckGoIdentityLink[]) {
  return Array.from(
    new Set(links.flatMap((link) => link.peers.map((peer) => peer.channel).filter(Boolean))),
  ).toSorted((left, right) => left.localeCompare(right));
}

function ChannelPill(props: { channel: string }) {
  return (
    <span className={`channel-pill channel-pill--${props.channel}`}>
      <span className="channel-pill__dot" aria-hidden="true" />
      <span>{props.channel}</span>
    </span>
  );
}

function HashChip(props: { value: string; label: string }) {
  return (
    <span className={`hash-chip ${props.value ? "hash-chip--ready" : "hash-chip--missing"}`}>
      <IconHash size={12} />
      <span>{props.label}</span>
      <code>{props.value || "..."}</code>
    </span>
  );
}

export function IdentityPanel() {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const identityLinksQuery = useIdentityLinksQuery();
  const linkIdentityMutation = useLinkIdentityPeerMutation();
  const unlinkIdentityMutation = useUnlinkIdentityPeerMutation();
  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [submittingLink, setSubmittingLink] = useState(false);
  const [pendingUnlinkKey, setPendingUnlinkKey] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [lastAction, setLastAction] = useState("");
  const agentProfileQuery = useAgentIdentityQuery("main", {
    enabled: selectedCanonical === "main",
  });
  const links = useMemo(() => identityLinksQuery.data?.links ?? [], [identityLinksQuery.data]);
  const configHash = identityLinksQuery.data?.configHash ?? "";
  const loadState: PanelState = identityLinksQuery.isFetching
    ? "loading"
    : identityLinksQuery.data
      ? "ready"
      : "idle";
  const agentProfile: DeckGoAgentIdentityResponse | null =
    selectedCanonical === "main" ? (agentProfileQuery.data ?? null) : null;
  const loadError =
    identityLinksQuery.error instanceof Error
      ? identityLinksQuery.error.message
      : identityLinksQuery.error
        ? t("loadFailed")
        : "";

  const refresh = useCallback(
    async (preferredCanonical?: string) => {
      try {
        const result = await identityLinksQuery.refetch();
        const response = result.data;
        const nextLinks = response?.links ?? [];
        setError("");
        setSelectedCanonical((current) => {
          const preferred = preferredCanonical?.trim();
          if (preferred && nextLinks.some((link) => link.canonical === preferred)) {
            return preferred;
          }
          if (current && nextLinks.some((link) => link.canonical === current)) {
            return current;
          }
          return nextLinks[0]?.canonical ?? null;
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [identityLinksQuery, t],
  );

  useEffect(() => {
    setSelectedCanonical((current) => {
      if (current && links.some((link) => link.canonical === current)) {
        return current;
      }
      return links[0]?.canonical ?? null;
    });
  }, [links]);

  const selectedLink = useMemo(
    () => links.find((link) => link.canonical === selectedCanonical) ?? null,
    [links, selectedCanonical],
  );

  const totalPeers = useMemo(
    () => links.reduce((total, link) => total + link.peers.length, 0),
    [links],
  );
  const channels = useMemo(() => channelMix(links), [links]);
  const selectedChannels = useMemo(
    () => Array.from(new Set((selectedLink?.peers ?? []).map((peer) => peer.channel))),
    [selectedLink],
  );
  const selectedPayload = useMemo(
    () =>
      JSON.stringify(
        {
          agentProfile: agentProfile ?? null,
          configHash: configHash || null,
          selected: selectedLink,
          links,
        },
        null,
        2,
      ),
    [agentProfile, configHash, links, selectedLink],
  );

  const requireConfigHash = useCallback(() => {
    if (configHash) {
      return true;
    }
    const message = t("hashRequired");
    setError(message);
    setDialogError(message);
    return false;
  }, [configHash, t]);

  const handleLink = async (input: IdentityLinkInput) => {
    const canonical = input.canonical.trim();
    const channel = input.channel.trim();
    const peerId = input.peerId.trim();

    if (!canonical || !channel || !peerId) {
      setDialogError(t("requiredFields"));
      return;
    }
    if (!requireConfigHash()) {
      return;
    }

    setSubmittingLink(true);
    setDialogError("");
    try {
      await linkIdentityMutation.mutateAsync({
        baseHash: configHash,
        canonical,
        channel,
        peerId,
      });
      setLastAction(t("linkedPeer", { channel, peerId, canonical }));
      setShowDialog(false);
      setError("");
      await refresh(canonical);
    } catch (actionError) {
      setDialogError(actionError instanceof Error ? actionError.message : t("linkFailed"));
      await refresh(canonical);
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleUnlink = async (canonical: string, channel: string, peerId: string) => {
    if (!requireConfigHash()) {
      return;
    }
    if (!window.confirm(t("unlinkConfirmDetailed", { channel, peerId, canonical }))) {
      return;
    }

    const nextPendingKey = `${canonical}:${channel}:${peerId}`;
    setPendingUnlinkKey(nextPendingKey);
    try {
      await unlinkIdentityMutation.mutateAsync({
        baseHash: configHash,
        canonical,
        channel,
        peerId,
      });
      setLastAction(t("unlinkedPeer", { channel, peerId, canonical }));
      setError("");
      await refresh(canonical);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("unlinkFailed"));
      await refresh(canonical);
    } finally {
      setPendingUnlinkKey("");
    }
  };

  const showUnsupportedMutation = useCallback(() => {
    setLastAction(t("unsupportedMutation"));
  }, [t]);

  return (
    <PanelRoot data-testid="identity-panel" density="compact">
      <div className="identity-panel">
        <PanelSectionHeader
          eyebrow="deck-go"
          title={t("title")}
          description={
            <>
              {t("description")} ·{" "}
              <code className="identity-panel__endpoint">GET /api/deck/identity</code>
            </>
          }
          actions={
            <PanelStatusRow align="end">
              <HashChip label="baseHash" value={configHash} />
              <PanelPill aria-label={t("bffOnlyTitle")}>
                <IconShield size={12} />
                <span>{t("bffOnly")}</span>
              </PanelPill>
              <button
                className="identity-panel__button identity-panel__button--icon"
                disabled={loadState === "loading"}
                type="button"
                onClick={() => void refresh(selectedCanonical ?? undefined)}
              >
                <IconRefresh size={14} />
                <span>{t("refresh")}</span>
              </button>
            </PanelStatusRow>
          }
        />

        <KpiStrip columns={4} aria-label={t("relationshipInventory")}>
          <PanelMetric
            label={t("canonicals")}
            value={t("canonicalCount", { count: links.length })}
          />
          <PanelMetric label={t("peers")} value={t("peerCount", { count: totalPeers })} />
          <PanelMetric
            label={t("channels")}
            value={channels.length ? channels.join(", ") : t("none")}
          />
          <PanelMetric
            label={t("hashState")}
            value={configHash ? t("hashReady") : t("hashMissing")}
            tone={configHash ? "positive" : "warning"}
          />
        </KpiStrip>

        {error || loadError ? <p className="identity-panel__error">{error || loadError}</p> : null}
        {lastAction ? (
          <div className="identity-panel__notice">
            <strong>{t("lastAction")}</strong>
            <p>{lastAction}</p>
          </div>
        ) : null}

        <div className="identity-app__layout">
          <IdentityList
            configHash={configHash}
            links={links}
            loading={loadState === "loading"}
            query={query}
            selectedCanonical={selectedCanonical}
            onCreateUnsupported={showUnsupportedMutation}
            onQueryChange={setQuery}
            onRefresh={() => void refresh(selectedCanonical ?? undefined)}
            onSelect={setSelectedCanonical}
          />

          <main className="identity-app__main">
            {loadState === "loading" && links.length === 0 ? (
              <section className="canonical-detail canonical-detail--empty">
                <PanelSurface tone="muted">
                  <h3>{tc("loading")}</h3>
                  <p>{t("contractSource")}</p>
                </PanelSurface>
              </section>
            ) : null}

            {loadState !== "loading" && links.length === 0 ? (
              <section className="canonical-detail canonical-detail--empty">
                <PanelSurface tone="muted">
                  <h3>{t("noLinks")}</h3>
                  <p>{t("emptyDescription")}</p>
                </PanelSurface>
              </section>
            ) : null}

            {links.length > 0 && !selectedLink ? (
              <section className="canonical-detail canonical-detail--empty">
                <PanelSurface tone="muted">
                  <h3>{t("selectIdentity")}</h3>
                  <p>{t("chooseCanonical")}</p>
                </PanelSurface>
              </section>
            ) : null}

            {selectedLink ? (
              <section className="canonical-detail">
                <PanelSurface tone="elevated">
                  <PanelSectionHeader
                    eyebrow={t("canonical")}
                    headingLevel={3}
                    title={
                      <span className="canonical-detail__title-inline">
                        {agentProfile?.emoji ? (
                          <span className="canonical-detail__emoji" aria-hidden="true">
                            {agentProfile.emoji}
                          </span>
                        ) : null}
                        <span>{selectedLink.canonical}</span>
                      </span>
                    }
                    description={
                      agentProfile?.name
                        ? t("agentProfileHint", { name: agentProfile.name })
                        : t("selectedDescription")
                    }
                    meta={
                      <PanelStatusRow>
                        <PanelPill tone="positive">
                          {t("peerCount", { count: selectedLink.peers.length })}
                        </PanelPill>
                        <PanelPill>
                          {t("channelCount", { count: selectedChannels.length })}
                        </PanelPill>
                        <HashChip label="baseHash" value={configHash} />
                      </PanelStatusRow>
                    }
                    actions={
                      <PanelStatusRow align="end">
                        <button
                          className="identity-panel__button identity-panel__button--icon is-primary"
                          type="button"
                          onClick={() => {
                            setDialogError("");
                            setShowDialog(true);
                          }}
                        >
                          <IconLink size={14} />
                          <span>{t("linkPeer")}</span>
                        </button>
                        <button
                          className="identity-panel__button identity-panel__button--icon"
                          title={t("unsupportedRename")}
                          type="button"
                          onClick={showUnsupportedMutation}
                        >
                          <IconEdit size={14} />
                          <span>{t("rename")}</span>
                        </button>
                        <button
                          className="identity-panel__button identity-panel__button--icon is-danger"
                          title={t("unsupportedDelete")}
                          type="button"
                          onClick={showUnsupportedMutation}
                        >
                          <IconTrash size={14} />
                          <span>{t("delete")}</span>
                        </button>
                      </PanelStatusRow>
                    }
                  />
                </PanelSurface>

                <PanelSurface tone={configHash ? "default" : "warning"}>
                  <div className="canonical-detail__banner">
                    <IconAlert size={15} />
                    <div>
                      <strong>{t("mutationSafety")}</strong>
                      <p>
                        {configHash
                          ? t("mutationSafetyDescription", { hash: configHash })
                          : t("mutationSafetyBlocked")}
                      </p>
                    </div>
                  </div>
                </PanelSurface>

                <PanelSurface>
                  <PanelSectionHeader
                    headingLevel={3}
                    title={t("peerMappings")}
                    description={t("peerMappingsDescription")}
                    meta={
                      <PanelPill>{t("peerCount", { count: selectedLink.peers.length })}</PanelPill>
                    }
                  />

                  {selectedLink.peers.length === 0 ? (
                    <div className="peer-empty">
                      <p className="peer-empty__title">{t("noPeersDetailed")}</p>
                      <p className="peer-empty__hint">{t("guardedSlotDescription")}</p>
                    </div>
                  ) : (
                    <div className="peer-list">
                      {selectedLink.peers.map((peer) => {
                        const currentPeerKey = peerKey(selectedLink.canonical, peer);
                        return (
                          <article className="peer-row" key={currentPeerKey}>
                            <div className="peer-row__left">
                              <div className={`peer-row__avatar peer-row__avatar--${peer.channel}`}>
                                <span>{peer.channel.slice(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="peer-row__id">
                                <div className="peer-row__id-line">
                                  <ChannelPill channel={peer.channel} />
                                  <code className="peer-row__peer-id">{peer.peerId}</code>
                                </div>
                                <p>
                                  {t("peerRelation", {
                                    canonical: selectedLink.canonical,
                                    channel: peer.channel,
                                    peerId: peer.peerId,
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="peer-row__meta">
                              <div className="peer-row__meta-row">
                                <IconClock size={12} />
                                <span>{t("lastSeenUnavailable")}</span>
                              </div>
                              <div className="peer-row__meta-row">
                                <IconShield size={12} />
                                <span>{t("activityProjectionUnavailable")}</span>
                              </div>
                            </div>
                            <div className="peer-row__actions">
                              <button
                                aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                                className="identity-panel__button identity-panel__button--icon"
                                disabled={pendingUnlinkKey === currentPeerKey}
                                type="button"
                                onClick={() =>
                                  void handleUnlink(
                                    selectedLink.canonical,
                                    peer.channel,
                                    peer.peerId,
                                  )
                                }
                              >
                                <IconUnlink size={14} />
                                <span>
                                  {pendingUnlinkKey === currentPeerKey ? tc("saving") : t("unlink")}
                                </span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </PanelSurface>

                <PanelSurface>
                  <PanelSectionHeader
                    headingLevel={3}
                    title={t("recentMutations")}
                    description={t("recentMutationsDescription")}
                  />
                  <div className="peer-empty">
                    <p className="peer-empty__title">{t("recentMutationsUnavailable")}</p>
                    <p className="peer-empty__hint">{t("recentMutationsProjection")}</p>
                  </div>
                </PanelSurface>

                <details className="identity-panel__raw">
                  <summary>{t("rawPayload")}</summary>
                  <pre>{selectedPayload}</pre>
                </details>
              </section>
            ) : null}
          </main>
        </div>

        <LinkDialog
          configHash={configHash}
          defaultCanonical={selectedLink?.canonical ?? ""}
          error={dialogError}
          open={showDialog}
          submitting={submittingLink}
          onClose={() => {
            setDialogError("");
            setShowDialog(false);
          }}
          onSubmit={(input) => void handleLink(input)}
        />
      </div>
    </PanelRoot>
  );
}
