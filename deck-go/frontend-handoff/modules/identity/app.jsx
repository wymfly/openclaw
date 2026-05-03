/* global React, ReactDOM, IDENTITY_FIXTURE, TweaksPanel,
   IdentityNav, CanonicalDetail,
   LinkPeerDialog, UnlinkPeerDialog, RenameCanonicalDialog,
   CreateCanonicalDialog, DeleteCanonicalDialog,
   IconRefresh, IconHash, IconShield */
const { useEffect, useMemo, useState } = React;

const advanceHash = (hash) => {
  // Simulate the BFF returning a new content hash on every successful mutation.
  const m = /^(.*-v)(\d+)$/.exec(hash || "");
  if (m) return `${m[1]}${parseInt(m[2], 10) + 1}`;
  return `${hash || "identity-hash"}-v2`;
};

const IdentityApp = () => {
  const [tweaks] = useState({ theme: "dark", density: "compact" });
  const [fixture, setFixture] = useState(IDENTITY_FIXTURE);
  const [selectedId, setSelectedId] = useState(IDENTITY_FIXTURE.canonicals[0]?.canonical || null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector(".identity-nav__search input");
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(
    () => fixture.canonicals.find((c) => c.canonical === selectedId) || null,
    [fixture, selectedId],
  );

  const refresh = () => {
    setFixture((prev) => ({ ...prev, fetchedAt: Date.now() }));
  };

  const recordMutation = (entry) => {
    setFixture((prev) => ({
      ...prev,
      configHash: advanceHash(prev.configHash),
      fetchedAt: Date.now(),
      recentMutations: [
        { ts: Date.now(), actor: "operator:daisy@deck.local", ...entry },
        ...prev.recentMutations,
      ].slice(0, 32),
    }));
  };

  const onCommitLink = (peerInput) => {
    setFixture((prev) => {
      const next = prev.canonicals.map((c) => {
        if (c.canonical !== selectedId) return c;
        return {
          ...c,
          peers: [
            ...c.peers,
            {
              channel: peerInput.channel,
              peerId: peerInput.peerId,
              displayName: peerInput.displayName || null,
              lastSeenMs: null,
              lastLinkedMs: Date.now(),
              actor: "operator:daisy@deck.local",
            },
          ],
        };
      });
      return { ...prev, canonicals: next };
    });
    recordMutation({
      kind: "link-peer",
      canonical: selectedId,
      peer: { channel: peerInput.channel, peerId: peerInput.peerId },
      ok: true,
    });
  };

  const onCommitUnlink = () => {
    if (!unlinkTarget) return;
    const peer = unlinkTarget;
    setFixture((prev) => ({
      ...prev,
      canonicals: prev.canonicals.map((c) =>
        c.canonical === selectedId
          ? {
              ...c,
              peers: c.peers.filter(
                (p) => !(p.channel === peer.channel && p.peerId === peer.peerId),
              ),
            }
          : c,
      ),
    }));
    recordMutation({
      kind: "unlink-peer",
      canonical: selectedId,
      peer: { channel: peer.channel, peerId: peer.peerId },
      ok: true,
    });
    setUnlinkTarget(null);
  };

  const onCommitRename = (next) => {
    setFixture((prev) => ({
      ...prev,
      canonicals: prev.canonicals.map((c) =>
        c.canonical === selectedId ? { ...c, canonical: next } : c,
      ),
    }));
    recordMutation({
      kind: "rename-canonical",
      canonical: next,
      from: selectedId,
      to: next,
      ok: true,
    });
    setSelectedId(next);
  };

  const onCommitCreate = ({ canonical, description }) => {
    setFixture((prev) => ({
      ...prev,
      canonicals: [
        ...prev.canonicals,
        {
          canonical,
          description: description || null,
          createdAtMs: Date.now(),
          peers: [],
        },
      ],
    }));
    recordMutation({
      kind: "create-canonical",
      canonical,
      ok: true,
    });
    setSelectedId(canonical);
  };

  const onCommitDelete = () => {
    setFixture((prev) => ({
      ...prev,
      canonicals: prev.canonicals.filter((c) => c.canonical !== selectedId),
    }));
    recordMutation({
      kind: "delete-canonical",
      canonical: selectedId,
      ok: true,
    });
    const remaining = fixture.canonicals.filter((c) => c.canonical !== selectedId);
    setSelectedId(remaining[0]?.canonical || null);
  };

  const existingNames = useMemo(() => fixture.canonicals.map((c) => c.canonical), [fixture]);

  return (
    <div className="identity-app" data-theme={tweaks.theme} data-density={tweaks.density}>
      <header className="identity-app__topbar">
        <div className="identity-app__brand">
          <p className="identity-app__eyebrow">deck-go</p>
          <h1>Identity</h1>
          <p className="identity-app__subtitle">
            Canonical ↔ channel peer registry · <code>GET /api/deck/identity</code>
          </p>
        </div>
        <div className="identity-app__topbar-meta">
          <span className="identity-app__hash" title={`baseHash: ${fixture.configHash}`}>
            <IconHash size={11} />
            <span>{fixture.configHash}</span>
          </span>
          <span className="identity-app__bootstrap" title="Bootstrap status">
            <IconShield size={11} />
            <span>
              {fixture.bootstrap.ok
                ? `${fixture.bootstrap.runtime?.mode} · ${fixture.bootstrap.runtime?.health}`
                : "bootstrap not ready"}
            </span>
          </span>
          <kbd className="identity-app__kbd">⌘K</kbd>
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={refresh}>
            <IconRefresh size={12} /> Refresh
          </button>
        </div>
      </header>

      <div className="identity-app__layout">
        <IdentityNav
          canonicals={fixture.canonicals}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          onQueryChange={setQuery}
          onCreate={() => setDialog({ kind: "create" })}
          fetchedAt={fixture.fetchedAt}
          configHash={fixture.configHash}
          onRefresh={refresh}
        />
        <main className="identity-app__main">
          <CanonicalDetail
            canonical={selected}
            configHash={fixture.configHash}
            now={now}
            recentMutations={fixture.recentMutations}
            bootstrap={fixture.bootstrap}
            agentProfile={fixture.agentProfile}
            onLinkPeer={() => setDialog({ kind: "link" })}
            onUnlinkPeer={(peer) => {
              setUnlinkTarget(peer);
              setDialog({ kind: "unlink" });
            }}
            onRename={() => setDialog({ kind: "rename" })}
            onDelete={() => setDialog({ kind: "delete" })}
          />
        </main>
      </div>

      {dialog?.kind === "link" && selected ? (
        <LinkPeerDialog
          canonical={selected.canonical}
          channels={fixture.channels}
          configHash={fixture.configHash}
          onClose={() => setDialog(null)}
          onCommit={onCommitLink}
        />
      ) : null}

      {dialog?.kind === "unlink" && unlinkTarget && selected ? (
        <UnlinkPeerDialog
          canonical={selected.canonical}
          peer={unlinkTarget}
          configHash={fixture.configHash}
          onClose={() => {
            setDialog(null);
            setUnlinkTarget(null);
          }}
          onCommit={onCommitUnlink}
        />
      ) : null}

      {dialog?.kind === "rename" && selected ? (
        <RenameCanonicalDialog
          canonical={selected.canonical}
          configHash={fixture.configHash}
          onClose={() => setDialog(null)}
          onCommit={onCommitRename}
        />
      ) : null}

      {dialog?.kind === "create" ? (
        <CreateCanonicalDialog
          existingNames={existingNames}
          configHash={fixture.configHash}
          onClose={() => setDialog(null)}
          onCommit={onCommitCreate}
        />
      ) : null}

      {dialog?.kind === "delete" && selected ? (
        <DeleteCanonicalDialog
          canonical={selected.canonical}
          configHash={fixture.configHash}
          onClose={() => setDialog(null)}
          onCommit={onCommitDelete}
        />
      ) : null}

      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<IdentityApp />);
