import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoIdentityLink, DeckGoIdentityPeer } from "../../../api";
import { fetchIdentityLinks, linkIdentityPeer, unlinkIdentityPeer } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { IdentityList } from "./IdentityList";
import { IdentityMetric } from "./IdentityMetric";
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

export function IdentityPanel() {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const [links, setLinks] = useState<DeckGoIdentityLink[]>([]);
  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  const [configHash, setConfigHash] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [showDialog, setShowDialog] = useState(false);
  const [submittingLink, setSubmittingLink] = useState(false);
  const [pendingUnlinkKey, setPendingUnlinkKey] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [lastAction, setLastAction] = useState("");

  const refresh = useCallback(
    async (preferredCanonical?: string) => {
      setLoadState("loading");
      try {
        const response = await fetchIdentityLinks();
        const nextLinks = response.links ?? [];
        setLinks(nextLinks);
        setConfigHash(response.configHash ?? "");
        setLoadState("ready");
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
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedLink = useMemo(
    () => links.find((link) => link.canonical === selectedCanonical) ?? null,
    [links, selectedCanonical],
  );

  const totalPeers = useMemo(
    () => links.reduce((total, link) => total + link.peers.length, 0),
    [links],
  );
  const channels = useMemo(() => channelMix(links), [links]);
  const selectedPayload = useMemo(
    () =>
      JSON.stringify(
        {
          configHash: configHash || null,
          selected: selectedLink,
          links,
        },
        null,
        2,
      ),
    [configHash, links, selectedLink],
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
      await linkIdentityPeer(canonical, channel, peerId, configHash);
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
      await unlinkIdentityPeer(canonical, channel, peerId, configHash);
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

  return (
    <section className="identity-panel" data-testid="identity-panel">
      <header className="identity-panel__header">
        <div className="identity-panel__title-stack">
          <p className="identity-panel__eyebrow">{t("eyebrow")}</p>
          <h2 className="identity-panel__title">{t("title")}</h2>
          <p className="identity-panel__description">{t("description")}</p>
          <p className="identity-panel__meta">{t("contractSource")}</p>
        </div>

        <div className="identity-panel__actions">
          <button
            className="identity-panel__button"
            disabled={loadState === "loading"}
            type="button"
            onClick={() => void refresh(selectedCanonical ?? undefined)}
          >
            {t("refresh")}
          </button>
          <button
            className="identity-panel__button is-primary"
            type="button"
            onClick={() => {
              setDialogError("");
              setShowDialog(true);
            }}
          >
            + {t("linkIdentity")}
          </button>
        </div>
      </header>

      <div className="identity-panel__metrics">
        <IdentityMetric
          label={t("canonicals")}
          value={t("canonicalCount", { count: links.length })}
        />
        <IdentityMetric label={t("peers")} value={t("peerCount", { count: totalPeers })} />
        <IdentityMetric
          label={t("channels")}
          value={channels.length ? channels.join(", ") : t("none")}
        />
        <IdentityMetric
          label={t("hashState")}
          value={configHash ? t("hashReady") : t("hashMissing")}
          tone={configHash ? "positive" : "warning"}
        />
      </div>

      {error ? <p className="identity-panel__error">{error}</p> : null}
      {lastAction ? (
        <div className="identity-panel__notice">
          <strong>{t("lastAction")}</strong>
          <p>{lastAction}</p>
        </div>
      ) : null}

      <div className="identity-panel__workspace">
        <IdentityList
          links={links}
          loading={loadState === "loading"}
          selectedCanonical={selectedCanonical}
          onSelect={setSelectedCanonical}
          onUnlink={handleUnlink}
        />

        <main className="identity-panel__column">
          <section className="identity-panel__card">
            <div className="identity-panel__card-head">
              <div>
                <h3 className="identity-panel__card-title">{t("selectedTitle")}</h3>
                <p className="identity-panel__meta">
                  {selectedLink ? t("selectedDescription") : t("chooseCanonical")}
                </p>
              </div>
              <span className={`identity-panel__pill ${configHash ? "is-positive" : "is-warning"}`}>
                {configHash ? t("hashLabel", { hash: configHash }) : t("hashMissing")}
              </span>
            </div>

            <div className="identity-panel__body">
              {loadState === "loading" && links.length === 0 ? (
                <p className="identity-panel__empty">{tc("loading")}</p>
              ) : null}

              {loadState !== "loading" && links.length === 0 ? (
                <div className="identity-panel__empty-state">
                  <h3>{t("noLinks")}</h3>
                  <p>{t("emptyDescription")}</p>
                </div>
              ) : null}

              {links.length > 0 && !selectedLink ? (
                <div className="identity-panel__empty-state">
                  <h3>{t("selectIdentity")}</h3>
                  <p>{t("chooseCanonical")}</p>
                </div>
              ) : null}

              {selectedLink ? (
                <>
                  <section className="identity-panel__hero">
                    <div>
                      <p className="identity-panel__label">{t("canonical")}</p>
                      <h3>{selectedLink.canonical}</h3>
                      <p className="identity-panel__meta">{t("selectedDescription")}</p>
                    </div>
                    <div className="identity-panel__pill-row">
                      <span className="identity-panel__pill is-positive">
                        {t("peerCount", { count: selectedLink.peers.length })}
                      </span>
                      <span
                        className={`identity-panel__pill ${configHash ? "is-positive" : "is-warning"}`}
                      >
                        {configHash ? t("baseHashReady") : t("hashMissing")}
                      </span>
                    </div>
                  </section>

                  <section
                    className={`identity-panel__guard ${configHash ? "is-ready" : "is-blocked"}`}
                  >
                    <div>
                      <strong>{t("mutationSafety")}</strong>
                      <p>
                        {configHash
                          ? t("mutationSafetyDescription", { hash: configHash })
                          : t("mutationSafetyBlocked")}
                      </p>
                    </div>
                    <span
                      className={`identity-panel__pill ${configHash ? "is-positive" : "is-warning"}`}
                    >
                      {configHash ? t("ready") : t("blocked")}
                    </span>
                  </section>

                  <section className="identity-panel__surface">
                    <div className="identity-panel__surface-head">
                      <div>
                        <h3>{t("peerMappings")}</h3>
                        <p className="identity-panel__meta">{t("peerMappingsDescription")}</p>
                      </div>
                      <span className="identity-panel__pill">
                        {t("peerCount", { count: selectedLink.peers.length })}
                      </span>
                    </div>

                    {selectedLink.peers.length === 0 ? (
                      <p className="identity-panel__empty">{t("noPeersDetailed")}</p>
                    ) : (
                      <div className="identity-panel__peer-list">
                        {selectedLink.peers.map((peer) => {
                          const currentPeerKey = peerKey(selectedLink.canonical, peer);
                          return (
                            <div className="identity-panel__peer" key={currentPeerKey}>
                              <span className="identity-panel__row-main">
                                <span className="identity-panel__row-head">
                                  <strong>{peer.channel}</strong>
                                  <span className="identity-panel__pill">{peer.peerId}</span>
                                </span>
                                <span className="identity-panel__meta">
                                  {t("peerRelation", {
                                    channel: peer.channel,
                                    peerId: peer.peerId,
                                    canonical: selectedLink.canonical,
                                  })}
                                </span>
                              </span>
                              <button
                                aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                                className="identity-panel__button"
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
                                {pendingUnlinkKey === currentPeerKey ? tc("saving") : t("unlink")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <details className="identity-panel__raw">
                    <summary>{t("rawPayload")}</summary>
                    <pre>{selectedPayload}</pre>
                  </details>
                </>
              ) : null}
            </div>
          </section>
        </main>
      </div>

      <LinkDialog
        error={dialogError}
        open={showDialog}
        submitting={submittingLink}
        onClose={() => {
          setDialogError("");
          setShowDialog(false);
        }}
        onSubmit={(input) => void handleLink(input)}
      />
    </section>
  );
}
