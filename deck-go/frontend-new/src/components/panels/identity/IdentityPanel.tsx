import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoIdentityLink, DeckGoIdentityPeer } from "../../../api";
import { fetchIdentityLinks, linkIdentityPeer, unlinkIdentityPeer } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { IdentityList } from "./IdentityList";
import { LinkDialog, type IdentityLinkInput } from "./LinkDialog";

type PanelState = "idle" | "loading" | "ready";

function peerKey(canonical: string, peer: DeckGoIdentityPeer) {
  return `${canonical}:${peer.channel}:${peer.peerId}`;
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
    <section className="deck-ui-control-shell deck-ui-identity">
      <IdentityList
        links={links}
        loading={loadState === "loading"}
        selectedCanonical={selectedCanonical}
        onSelect={setSelectedCanonical}
        onUnlink={handleUnlink}
      />

      <main className="deck-ui-control-detail deck-ui-identity-detail">
        <header className="deck-ui-identity-detail-header">
          <div>
            <h2>{selectedLink?.canonical ?? t("selectIdentity")}</h2>
            <p>{selectedLink ? t("selectedDescription") : t("chooseCanonical")}</p>
          </div>
          <button
            className="deckgo-button is-primary deck-ui-identity-button"
            type="button"
            onClick={() => {
              setDialogError("");
              setShowDialog(true);
            }}
          >
            + {t("linkIdentity")}
          </button>
        </header>

        <div className="deck-ui-identity-status-row">
          <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </span>
          <span className="deckgo-pill">{t("canonicalCount", { count: links.length })}</span>
          <span className="deckgo-pill">{t("peerCount", { count: totalPeers })}</span>
          <span className="deckgo-pill">
            {configHash ? t("hashLabel", { hash: configHash }) : t("hashMissing")}
          </span>
        </div>

        {error ? <p className="deck-ui-control-error">{error}</p> : null}
        {lastAction ? (
          <div className="deck-ui-control-status-card">
            <strong>{t("lastAction")}</strong>
            <p>{lastAction}</p>
          </div>
        ) : null}

        {loadState === "loading" && links.length === 0 ? (
          <p className="deck-ui-control-empty">{tc("loading")}</p>
        ) : null}

        {loadState !== "loading" && links.length === 0 ? (
          <div className="deck-ui-control-empty-state">
            <h3>{t("noLinks")}</h3>
            <p>{t("emptyDescription")}</p>
          </div>
        ) : null}

        {links.length > 0 && !selectedLink ? (
          <div className="deck-ui-control-empty-state">
            <h3>{t("selectIdentity")}</h3>
            <p>{t("chooseCanonical")}</p>
          </div>
        ) : null}

        {selectedLink ? (
          <section className="deck-ui-identity-surface">
            <div className="deck-ui-control-status-header">
              <div>
                <span className="deckgo-surface-label">{t("selectedTitle")}</span>
                <h3>{selectedLink.canonical}</h3>
              </div>
              <span className="deckgo-pill">
                {t("peerCount", { count: selectedLink.peers.length })}
              </span>
            </div>

            {selectedLink.peers.length === 0 ? (
              <p className="deck-ui-control-empty">{t("noPeersDetailed")}</p>
            ) : (
              <div className="deck-ui-control-list deck-ui-identity-peer-list">
                {selectedLink.peers.map((peer) => {
                  const currentPeerKey = peerKey(selectedLink.canonical, peer);
                  return (
                    <div className="deck-ui-control-row" key={currentPeerKey}>
                      <span className="deck-ui-control-row-main">
                        <span className="deck-ui-control-row-header">
                          <strong>{peer.channel}</strong>
                          <span className="deckgo-pill">{peer.peerId}</span>
                        </span>
                      </span>
                      <button
                        aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                        className="deckgo-button deckgo-button-compact deck-ui-identity-button"
                        disabled={pendingUnlinkKey === currentPeerKey}
                        type="button"
                        onClick={() =>
                          void handleUnlink(selectedLink.canonical, peer.channel, peer.peerId)
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
        ) : null}
      </main>

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
