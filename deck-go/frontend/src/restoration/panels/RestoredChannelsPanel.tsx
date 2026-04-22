import { useEffect, useMemo, useState } from "react";
import type { DeckGoChannelsStatusResponse } from "../../../../contracts/generated/ts/deck-api.generated";
import { fetchChannels, logoutChannel } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function RestoredChannelsPanel() {
  const [payload, setPayload] = useState<DeckGoChannelsStatusResponse | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "logging-out">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const refresh = async (preferredChannelId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchChannels();
      setPayload(next);
      setLoadState("ready");
      setError("");
      const order = next.channelOrder?.length
        ? next.channelOrder
        : Object.keys(asRecord(next.channels));
      const fallbackId = preferredChannelId?.trim() || order[0] || "";
      setSelectedChannelId((current) =>
        order.includes(current)
          ? current
          : order.includes(fallbackId)
            ? fallbackId
            : order[0] || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load channels");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const channelOrder = useMemo(
    () =>
      payload?.channelOrder?.length
        ? payload.channelOrder
        : Object.keys(asRecord(payload?.channels)),
    [payload],
  );
  const labels = payload?.channelLabels ?? {};
  const rawChannels = asRecord(payload?.channels);
  const rawChannelAccounts = asRecord(payload?.channelAccounts);
  const selectedChannel = selectedChannelId ? asRecord(rawChannels[selectedChannelId]) : {};
  const selectedAccounts = asRecord(rawChannelAccounts[selectedChannelId]);
  const accountEntries = Object.entries(selectedAccounts);
  const selectedDefaultAccountId = payload?.channelDefaultAccountId?.[selectedChannelId] || "";
  const totalAccounts = Object.values(rawChannelAccounts).reduce((sum: number, value) => {
    return sum + Object.keys(asRecord(value)).length;
  }, 0);

  const runLogout = async () => {
    if (!selectedChannelId) {
      return;
    }
    setActionState("logging-out");
    try {
      const result = await logoutChannel(selectedChannelId);
      setActionResult(result);
      setError("");
      await refresh(selectedChannelId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "channel logout failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Channel inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned read/write adapter over `channels.status` and `channels.logout`.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Inventory {loadState}
              </span>
              <span className="deckgo-pill">ts: {payload?.ts ?? "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="channels" value={channelOrder.length} />
              <ShellStat label="accounts" value={totalAccounts} />
              <ShellStat
                label="defaults"
                value={Object.keys(payload?.channelDefaultAccountId ?? {}).length}
              />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedChannelId)}
              >
                Refresh channels
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void runLogout()}
                disabled={!selectedChannelId || actionState === "logging-out"}
              >
                {actionState === "logging-out" ? "Logging out" : "Logout channel"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {channelOrder.length === 0 ? (
              <p className="deckgo-note">No channels loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {channelOrder.map((channelId) => {
                  const channelAccounts = asRecord(rawChannelAccounts[channelId]);
                  return (
                    <li key={channelId}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card ${selectedChannelId === channelId ? "is-selected" : ""}`}
                        onClick={() => setSelectedChannelId(channelId)}
                      >
                        <strong>{labels[channelId] || channelId}</strong>
                        <div className="deckgo-meta">
                          id: {channelId} | default account:{" "}
                          {payload?.channelDefaultAccountId?.[channelId] || "n/a"}
                        </div>
                        <div className="deckgo-meta">
                          accounts: {Object.keys(channelAccounts).length}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected channel</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This keeps the first channel slice narrow: inventory truth, account wiring, and logout.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedChannelId ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Channel</p>
                    <strong>{labels[selectedChannelId] || selectedChannelId}</strong>
                    <p className="deckgo-note">
                      default account: {selectedDefaultAccountId || "n/a"}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{accountEntries.length} accounts</span>
                    <span className="deckgo-pill">channel id {selectedChannelId}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="label" value={labels[selectedChannelId] || selectedChannelId} />
                  <ShellStat label="default account" value={selectedDefaultAccountId || "n/a"} />
                </div>
                {accountEntries.length > 0 ? (
                  <ul className="deckgo-shell-list">
                    {accountEntries.map(([accountId, accountPayload]) => (
                      <li key={accountId}>
                        <div className="deckgo-selectable-card">
                          <strong>{accountId}</strong>
                          <div className="deckgo-meta">{JSON.stringify(accountPayload)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="deckgo-note">No channel accounts reported.</p>
                )}
                <JsonDetails title="Channel payload" payload={selectedChannel} />
                <JsonDetails title="Logout result" payload={actionResult} />
              </>
            ) : (
              <p className="deckgo-note">Choose a channel to inspect its payload.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
