import { useEffect, useState } from "react";
import type { DeckGoIdentityLink } from "../../api";
import { fetchIdentityLinks, linkIdentityPeer, unlinkIdentityPeer } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

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

export function RestoredIdentityPanel() {
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
        nextLinks.some((link) => link.canonical === current)
          ? current
          : nextLinks.some((link) => link.canonical === fallback)
            ? fallback
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

  const linkAction = async () => {
    setActionState("linking");
    try {
      const result = await linkIdentityPeer(
        draft.canonical.trim(),
        draft.channel.trim(),
        draft.peerId.trim(),
        configHash,
      );
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(draft.canonical.trim());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "identity link failed");
    } finally {
      setActionState("idle");
    }
  };

  const unlinkAction = async (channel: string, peerId: string) => {
    if (!selectedLink) {
      return;
    }
    setActionState("unlinking");
    try {
      const result = await unlinkIdentityPeer(selectedLink.canonical, channel, peerId, configHash);
      setActionResult(result);
      setError("");
      await refresh(selectedLink.canonical);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "identity unlink failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Identity links</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned identity slice for canonical-to-peer links.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Identity {loadState}
              </span>
              <span className="deckgo-pill">{links.length} canonicals</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="canonicals" value={links.length} />
              <ShellStat
                label="peers"
                value={links.reduce((sum, link) => sum + link.peers.length, 0)}
              />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Link identity</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={draft.canonical}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, canonical: event.target.value }))
                  }
                  placeholder="canonical"
                />
                <input
                  className="deckgo-input"
                  value={draft.channel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  placeholder="channel"
                />
                <input
                  className="deckgo-input"
                  value={draft.peerId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, peerId: event.target.value }))
                  }
                  placeholder="peer id"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedCanonical)}
                >
                  Refresh identity
                </button>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void linkAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "linking" ? "Linking" : "Link identity"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {links.length === 0 ? (
              <p className="deckgo-note">No identity links loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {links.map((link) => (
                  <li key={link.canonical}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedLink?.canonical === link.canonical ? "is-selected" : ""}`}
                      onClick={() => setSelectedCanonical(link.canonical)}
                    >
                      <strong>{link.canonical}</strong>
                      <div className="deckgo-meta">{link.peers.length} peers</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected canonical</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice keeps identity management focused on current links and explicit unlink
            actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedLink ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Canonical</p>
                    <strong>{selectedLink.canonical}</strong>
                    <p className="deckgo-note">{selectedLink.peers.length} linked peers</p>
                  </div>
                </div>
                <ul className="deckgo-shell-list">
                  {selectedLink.peers.map((peer) => (
                    <li key={`${peer.channel}:${peer.peerId}`}>
                      <div className="deckgo-selectable-card">
                        <strong>{peer.channel}</strong>
                        <div className="deckgo-meta">{peer.peerId}</div>
                        <div className="deckgo-actions" style={{ marginTop: 8 }}>
                          <button
                            className="deckgo-button is-danger"
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
                <JsonDetails title="Identity payload" payload={selectedLink} />
              </>
            ) : (
              <p className="deckgo-note">Choose a canonical identity to inspect it.</p>
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
