import { useEffect, useState } from "react";
import type { DeckGoIdentityLink } from "../../../api";
import { fetchIdentityLinks, linkIdentityPeer, unlinkIdentityPeer } from "../../../api";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type LinkDraft = {
  canonical: string;
  channel: string;
  peerId: string;
};

const DEFAULT_DRAFT: LinkDraft = {
  canonical: "",
  channel: "",
  peerId: "",
};

export function IdentityPanel() {
  const [links, setLinks] = useState<DeckGoIdentityLink[]>([]);
  const [configHash, setConfigHash] = useState("");
  const [selectedCanonical, setSelectedCanonical] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "linking" | "unlinking">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredCanonical?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchIdentityLinks();
      const nextLinks = next.links ?? [];
      setLinks(nextLinks);
      setConfigHash(next.configHash ?? "");
      setLoadState("ready");
      setError("");
      const fallback = preferredCanonical?.trim() || nextLinks[0]?.canonical || "";
      setSelectedCanonical((current) =>
        fallback && nextLinks.some((link) => link.canonical === fallback)
          ? fallback
          : current && nextLinks.some((link) => link.canonical === current)
            ? current
            : nextLinks[0]?.canonical || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load identities");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedLink =
    links.find((link) => link.canonical === selectedCanonical) ?? links[0] ?? null;
  const draftIsComplete = Boolean(
    draft.canonical.trim() && draft.channel.trim() && draft.peerId.trim(),
  );

  const linkAction = async () => {
    const canonical = draft.canonical.trim();
    const channel = draft.channel.trim();
    const peerId = draft.peerId.trim();
    if (!canonical || !channel || !peerId) {
      setError("canonical, channel, and peer id are required");
      return;
    }
    if (!configHash.trim()) {
      setError("identity config hash is required; refresh identity links first");
      return;
    }
    setActionState("linking");
    try {
      const result = await linkIdentityPeer(canonical, channel, peerId, configHash);
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(canonical);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "identity link failed";
      setError(message);
      await refresh(canonical);
      setError(message);
    } finally {
      setActionState("idle");
    }
  };

  const unlinkAction = async (channel: string, peerId: string) => {
    if (!selectedLink) {
      return;
    }
    await unlinkPeerAction(selectedLink.canonical, channel, peerId);
  };

  const unlinkPeerAction = async (canonical: string, channel: string, peerId: string) => {
    if (!configHash.trim()) {
      setError("identity config hash is required; refresh identity links first");
      return;
    }
    if (!window.confirm(`Unlink ${channel}:${peerId} from ${canonical}?`)) {
      return;
    }
    setActionState("unlinking");
    try {
      const result = await unlinkIdentityPeer(canonical, channel, peerId, configHash);
      setActionResult(result);
      setError("");
      await refresh(canonical);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "identity unlink failed";
      setError(message);
      await refresh(canonical);
      setError(message);
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-identity">
      <div className="deckgo-column deck-ui-identity-column">
        <article className="deckgo-card is-float deck-ui-identity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Identity links</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Identity management links canonical identities to channel peers.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-identity-body">
            <div className="deckgo-pill-row deck-ui-identity-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Identity {loadState}
              </span>
              <span className="deckgo-pill">{links.length} canonicals</span>
              <span className="deckgo-pill">hash {configHash || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-identity-stats">
              <ShellStat label="canonicals" value={links.length} />
              <ShellStat
                label="peers"
                value={links.reduce((sum, link) => sum + link.peers.length, 0)}
              />
            </div>
            <div className="deckgo-surface-tile deck-ui-identity-surface">
              <p className="deckgo-surface-label">Link identity</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-identity-form-grid">
                <input
                  className="deckgo-input deck-ui-identity-input"
                  value={draft.canonical}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, canonical: event.target.value }))
                  }
                  placeholder="canonical"
                />
                <input
                  className="deckgo-input deck-ui-identity-input"
                  value={draft.channel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  placeholder="channel"
                />
                <input
                  className="deckgo-input deck-ui-identity-input"
                  value={draft.peerId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, peerId: event.target.value }))
                  }
                  placeholder="peer id"
                />
              </div>
              <div className="deckgo-actions deck-ui-identity-actions deck-ui-identity-actions-offset">
                <button
                  className="deckgo-button deck-ui-identity-button"
                  type="button"
                  onClick={() => void refresh(selectedCanonical)}
                >
                  Refresh identity
                </button>
                <button
                  className="deckgo-button is-primary deck-ui-identity-button"
                  type="button"
                  onClick={() => void linkAction()}
                  disabled={actionState !== "idle" || !draftIsComplete}
                >
                  {actionState === "linking" ? "Linking" : "Link identity"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-identity-error">{error}</p> : null}
            {links.length === 0 ? (
              <p className="deckgo-note deck-ui-identity-empty">No identity links loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-identity-list">
                {links.map((link) => (
                  <li key={link.canonical}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-identity-row ${selectedLink?.canonical === link.canonical ? "is-selected" : ""}`}
                      onClick={() => setSelectedCanonical(link.canonical)}
                    >
                      <strong>{link.canonical}</strong>
                      <div className="deckgo-meta">{link.peers.length} peers</div>
                      {link.peers.length > 0 ? (
                        <div className="deckgo-pill-row deck-ui-identity-status-row deck-ui-identity-peer-pills">
                          {link.peers.map((peer) => (
                            <span
                              className="deckgo-pill"
                              key={`${link.canonical}:${peer.channel}:${peer.peerId}`}
                            >
                              {peer.channel}: {peer.peerId}
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                                className="deckgo-inline-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void unlinkPeerAction(link.canonical, peer.channel, peer.peerId);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") {
                                    return;
                                  }
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void unlinkPeerAction(link.canonical, peer.channel, peer.peerId);
                                }}
                              >
                                ×
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="deckgo-meta">No peers linked</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-identity-column">
        <article className="deckgo-card is-float deck-ui-identity-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected canonical</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Manage current links and explicit unlink actions from the selected canonical identity.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-identity-body">
            {selectedLink ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-identity-hero">
                  <div>
                    <p className="deckgo-kicker">Canonical</p>
                    <strong>{selectedLink.canonical}</strong>
                    <p className="deckgo-note">{selectedLink.peers.length} linked peers</p>
                  </div>
                </div>
                {selectedLink.peers.length === 0 ? (
                  <p className="deckgo-note deck-ui-identity-empty">
                    No peers linked to this canonical.
                  </p>
                ) : (
                  <ul className="deckgo-shell-list deck-ui-identity-list">
                    {selectedLink.peers.map((peer) => (
                      <li key={`${peer.channel}:${peer.peerId}`}>
                        <div className="deckgo-selectable-card deck-ui-identity-row">
                          <strong>{peer.channel}</strong>
                          <div className="deckgo-meta">{peer.peerId}</div>
                          <div className="deckgo-actions deck-ui-identity-actions deck-ui-identity-actions-offset">
                            <button
                              className="deckgo-button is-danger deck-ui-identity-button"
                              type="button"
                              onClick={() => void unlinkAction(peer.channel, peer.peerId)}
                              disabled={actionState !== "idle"}
                            >
                              {actionState === "unlinking" ? "Unlinking" : "Unlink"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <JsonDetails title="Identity payload" payload={selectedLink} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-identity-empty">
                Choose a canonical identity to inspect it.
              </p>
            )}
            {actionResult ? (
              <JsonDetails title="Last identity action" payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
