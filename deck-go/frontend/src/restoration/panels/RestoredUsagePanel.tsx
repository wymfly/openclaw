import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoUsageCostEntry,
  DeckGoUsageProviderStatus,
  DeckGoUsageProviderWindow,
} from "../../api";
import { fetchModelUsageCost, fetchModelUsageProviders } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatReset(resetAt?: number) {
  if (!resetAt) {
    return "n/a";
  }
  const remaining = Math.max(0, resetAt - Date.now());
  const hours = Math.floor(remaining / (60 * 60 * 1_000));
  const minutes = Math.floor((remaining % (60 * 60 * 1_000)) / (60 * 1_000));
  return `${hours}h ${minutes}m`;
}

export function RestoredUsagePanel() {
  const [days, setDays] = useState("14");
  const [costEntries, setCostEntries] = useState<DeckGoUsageCostEntry[]>([]);
  const [providers, setProviders] = useState<DeckGoUsageProviderStatus[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");

  const refresh = async (preferredProviderId?: string) => {
    setLoadState("loading");
    try {
      const parsedDays = Number.parseInt(days, 10);
      const [costResponse, providersResponse] = await Promise.all([
        fetchModelUsageCost(Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : undefined),
        fetchModelUsageProviders(),
      ]);
      const nextCosts = (costResponse.daily ?? [])
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date));
      const nextProviders = providersResponse.providers ?? [];
      setCostEntries(nextCosts);
      setProviders(nextProviders);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredProviderId?.trim() || nextProviders[0]?.provider || "";
      setSelectedProviderId((current) =>
        nextProviders.some((provider) => provider.provider === current)
          ? current
          : nextProviders.some((provider) => provider.provider === fallbackId)
            ? fallbackId
            : nextProviders[0]?.provider || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load usage");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedProvider =
    providers.find((provider) => provider.provider === selectedProviderId) ?? providers[0] ?? null;
  const totalCost = useMemo(
    () =>
      costEntries.reduce((sum, entry) => {
        return sum + (entry.totalCost ?? entry.cost ?? 0);
      }, 0),
    [costEntries],
  );
  const hottestWindow = useMemo(() => {
    const windows = providers.flatMap((provider) =>
      provider.windows.map((window) => ({ provider: provider.provider, window })),
    );
    return (
      windows.sort((left, right) => right.window.usedPercent - left.window.usedPercent)[0] ?? null
    );
  }, [providers]);

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Usage</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned cost and provider quota overview over the current model usage seams.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Usage {loadState}
              </span>
              <span className="deckgo-pill">{costEntries.length} days</span>
              <span className="deckgo-pill">{providers.length} providers</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="days" value={costEntries.length} />
              <ShellStat label="providers" value={providers.length} />
              <ShellStat label="total cost" value={formatCurrency(totalCost)} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Refresh usage range</p>
              <div className="deckgo-actions">
                <input
                  className="deckgo-input"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  placeholder="days"
                />
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedProviderId)}
                >
                  Refresh usage
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Daily cost trend</p>
              {costEntries.length === 0 ? (
                <p className="deckgo-note">No cost usage loaded.</p>
              ) : (
                <ul className="deckgo-shell-list">
                  {costEntries.map((entry) => {
                    const value = entry.totalCost ?? entry.cost ?? 0;
                    return (
                      <li key={entry.date}>
                        <div className="deckgo-selectable-card">
                          <strong>{entry.date}</strong>
                          <div className="deckgo-meta">{formatCurrency(value)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Provider quotas</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice avoids the deeper analytics shell and keeps Stage 3 anchored on current cost
            and provider-pressure truth from the control plane.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {hottestWindow ? (
              <div className="deckgo-restored-hero-strip">
                <div>
                  <p className="deckgo-kicker">Highest pressure window</p>
                  <strong>{hottestWindow.provider}</strong>
                  <p className="deckgo-note">{hottestWindow.window.label}</p>
                </div>
                <div className="deckgo-pill-row">
                  <span className="deckgo-pill">{hottestWindow.window.usedPercent}% used</span>
                  <span className="deckgo-pill">
                    resets in {formatReset(hottestWindow.window.resetAt)}
                  </span>
                </div>
              </div>
            ) : null}
            {providers.length === 0 ? (
              <p className="deckgo-note">No provider usage loaded.</p>
            ) : (
              <>
                <ul className="deckgo-shell-list">
                  {providers.map((provider) => (
                    <li key={provider.provider}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card ${selectedProvider?.provider === provider.provider ? "is-selected" : ""}`}
                        onClick={() => setSelectedProviderId(provider.provider)}
                      >
                        <strong>{provider.displayName || provider.provider}</strong>
                        <div className="deckgo-meta">
                          plan: {provider.plan || "n/a"} | windows: {provider.windows.length}
                        </div>
                        {provider.error ? (
                          <div className="deckgo-meta">{provider.error}</div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                {selectedProvider ? (
                  <>
                    <div className="deckgo-grid deckgo-grid-2">
                      <ShellStat label="provider" value={selectedProvider.provider} />
                      <ShellStat label="windows" value={selectedProvider.windows.length} />
                    </div>
                    <ul className="deckgo-shell-list">
                      {selectedProvider.windows.map((window: DeckGoUsageProviderWindow) => (
                        <li key={`${selectedProvider.provider}-${window.label}`}>
                          <div className="deckgo-selectable-card">
                            <strong>{window.label}</strong>
                            <div className="deckgo-meta">{window.usedPercent}% used</div>
                            <div className="deckgo-meta">
                              resets in {formatReset(window.resetAt)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <JsonDetails title="Provider payload" payload={selectedProvider} />
                  </>
                ) : null}
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
