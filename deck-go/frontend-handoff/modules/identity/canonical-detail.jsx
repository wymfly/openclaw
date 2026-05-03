/* global React, IconLink, IconUnlink, IconEdit, IconTrash, IconClock, IconAlert, IconCheck, ChannelPill, ChannelIcon, StatusPill, HashChip, ActorChip */
const { useMemo } = React;

const fmtRelative = (now, ts) => {
  if (!ts) return "—";
  const d = Math.max(0, now - ts);
  if (d < 60_000) return `${Math.round(d / 1000)}s ago`;
  if (d < 60 * 60_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 24 * 60 * 60_000) return `${Math.round(d / (60 * 60_000))}h ago`;
  return `${Math.round(d / (24 * 60 * 60_000))}d ago`;
};

const fmtAbsolute = (ts) => {
  if (!ts) return "—";
  const dt = new Date(ts);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mn = String(dt.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mn}`;
};

const PeerRow = ({ peer, now, onUnlink, locked }) => {
  const stale = peer.lastSeenMs && now - peer.lastSeenMs > 5 * 60 * 60 * 1000;
  return (
    <article className={`peer-row ${stale ? "peer-row--stale" : ""}`}>
      <div className="peer-row__left">
        <div className={`peer-row__avatar peer-row__avatar--${peer.channel}`}>
          <ChannelIcon channel={peer.channel} size={14} />
        </div>
        <div className="peer-row__id">
          <div className="peer-row__id-line">
            <ChannelPill channel={peer.channel} />
            <code className="peer-row__peer-id">{peer.peerId}</code>
          </div>
          {peer.displayName ? <p className="peer-row__display">{peer.displayName}</p> : null}
        </div>
      </div>
      <div className="peer-row__meta">
        <div className="peer-row__meta-row" title={fmtAbsolute(peer.lastSeenMs)}>
          <IconClock size={11} />
          <span>last seen {fmtRelative(now, peer.lastSeenMs)}</span>
          {stale ? <span className="peer-row__stale-pill">stale</span> : null}
        </div>
        <div className="peer-row__meta-row" title={fmtAbsolute(peer.lastLinkedMs)}>
          <IconLink size={11} />
          <span>linked {fmtRelative(now, peer.lastLinkedMs)}</span>
        </div>
        <div className="peer-row__meta-row peer-row__meta-row--actor">
          <ActorChip actor={peer.actor} />
        </div>
      </div>
      <div className="peer-row__actions">
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--warn ds-btn--sm"
          onClick={() => onUnlink(peer)}
          disabled={locked}
          title={locked ? "Cannot unlink: bootstrap not ready" : "Unlink peer"}
        >
          <IconUnlink size={12} /> Unlink
        </button>
      </div>
    </article>
  );
};

const RecentMutationRow = ({ entry, now }) => {
  const ok = entry.ok !== false;
  const tone = ok ? "success" : "error";
  return (
    <article className={`mutation-row mutation-row--${tone}`}>
      <div className="mutation-row__head">
        <span className={`mutation-row__kind mutation-row__kind--${entry.kind}`}>{entry.kind}</span>
        <span className="mutation-row__canonical">{entry.canonical}</span>
        <span className="mutation-row__time" title={fmtAbsolute(entry.ts)}>
          {fmtRelative(now, entry.ts)}
        </span>
      </div>
      {entry.peer ? (
        <div className="mutation-row__peer">
          <ChannelPill channel={entry.peer.channel} />
          <code>{entry.peer.peerId}</code>
        </div>
      ) : null}
      {entry.kind === "rename-canonical" ? (
        <div className="mutation-row__rename">
          <code>{entry.from}</code>
          <span>→</span>
          <code>{entry.to}</code>
        </div>
      ) : null}
      <div className="mutation-row__foot">
        <ActorChip actor={entry.actor} />
        {ok ? (
          <StatusPill tone="success" icon={IconCheck}>
            ok
          </StatusPill>
        ) : (
          <StatusPill tone="error" icon={IconAlert}>
            {entry.error || "failed"}
          </StatusPill>
        )}
      </div>
    </article>
  );
};

const CanonicalDetail = ({
  canonical,
  configHash,
  now,
  recentMutations,
  bootstrap,
  agentProfile,
  onLinkPeer,
  onUnlinkPeer,
  onRename,
  onDelete,
}) => {
  const peers = canonical?.peers || [];
  const channelSet = useMemo(() => Array.from(new Set(peers.map((p) => p.channel))), [peers]);
  const ownMutations = useMemo(
    () =>
      recentMutations.filter(
        (m) =>
          m.canonical === canonical?.canonical ||
          (m.kind === "rename-canonical" && m.to === canonical?.canonical),
      ),
    [recentMutations, canonical],
  );
  const locked = !bootstrap?.ok;
  const isSystemCanonical = canonical?.canonical === "system";

  if (!canonical) {
    return (
      <section className="canonical-detail canonical-detail--empty">
        <div className="canonical-detail__empty-card">
          <h2>No canonical selected</h2>
          <p>Pick a canonical from the left rail to inspect its peers and mutation history.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canonical-detail">
      <header className="canonical-detail__hero">
        <div className="canonical-detail__hero-left">
          <p className="canonical-detail__eyebrow">Canonical</p>
          <h1 className="canonical-detail__title">
            {agentProfile?.emoji && canonical.canonical === agentProfile.agentId ? (
              <span className="canonical-detail__emoji" aria-hidden="true">
                {agentProfile.emoji}
              </span>
            ) : null}
            <span>{canonical.canonical}</span>
          </h1>
          {canonical.description ? (
            <p className="canonical-detail__hint">{canonical.description}</p>
          ) : null}
          <div className="canonical-detail__hero-meta">
            <StatusPill tone={peers.length === 0 ? "warn" : "accent"}>
              {peers.length} {peers.length === 1 ? "peer" : "peers"}
            </StatusPill>
            <StatusPill tone="iron">
              {channelSet.length} {channelSet.length === 1 ? "channel" : "channels"}
            </StatusPill>
            <HashChip value={configHash} tone="accent" label="baseHash" />
          </div>
        </div>
        <div className="canonical-detail__hero-actions">
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={onLinkPeer}
            disabled={locked}
          >
            <IconLink size={12} /> Link peer
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost"
            onClick={onRename}
            disabled={locked || isSystemCanonical}
            title={isSystemCanonical ? "system canonical cannot be renamed" : "Rename canonical"}
          >
            <IconEdit size={12} /> Rename
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--warn"
            onClick={onDelete}
            disabled={locked || isSystemCanonical || peers.length > 0}
            title={
              isSystemCanonical
                ? "system canonical cannot be deleted"
                : peers.length > 0
                  ? "Unlink all peers before deleting"
                  : "Delete empty canonical"
            }
          >
            <IconTrash size={12} /> Delete
          </button>
        </div>
      </header>

      {locked ? (
        <div className="canonical-detail__banner canonical-detail__banner--warn" role="alert">
          <IconAlert size={14} />
          <div>
            <strong>Bootstrap not ready.</strong>
            <p>Mutations disabled until /api/bootstrap/status returns ok=true.</p>
          </div>
        </div>
      ) : null}

      <section className="canonical-detail__section">
        <header className="canonical-detail__section-head">
          <h2>Peers</h2>
          <p className="canonical-detail__section-hint">
            Channel ↔ peer mappings that resolve to this canonical. Mutations are guarded by
            baseHash.
          </p>
        </header>
        {peers.length === 0 ? (
          <div className="peer-empty">
            <p className="peer-empty__title">No peers linked.</p>
            <p className="peer-empty__hint">
              This canonical is reserved. Use <kbd>Link peer</kbd> to bind a channel peer.
            </p>
          </div>
        ) : (
          <div className="peer-list">
            {peers.map((p) => (
              <PeerRow
                key={`${p.channel}/${p.peerId}`}
                peer={p}
                now={now}
                onUnlink={onUnlinkPeer}
                locked={locked}
              />
            ))}
          </div>
        )}
      </section>

      <section className="canonical-detail__section">
        <header className="canonical-detail__section-head">
          <h2>Recent mutations</h2>
          <p className="canonical-detail__section-hint">
            Last 8 events scoped to this canonical. Errors expose baseHash drift surfaces.
          </p>
        </header>
        {ownMutations.length === 0 ? (
          <div className="peer-empty">
            <p className="peer-empty__title">No recent mutations.</p>
          </div>
        ) : (
          <div className="mutation-list">
            {ownMutations.slice(0, 8).map((m, i) => (
              <RecentMutationRow key={i} entry={m} now={now} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

Object.assign(window, { CanonicalDetail, fmtRelative, fmtAbsolute });
