import { useEffect, useMemo, useState } from "react";
import type { DeckGoGatewayDescribeResponse } from "../../api";
import { fetchGatewayDescribe } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type ExplorerTab = "methods" | "events";
type PanelState = "idle" | "loading" | "ready";

type MethodInfo = {
  name: string;
  scope: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  since?: number;
};

type EventInfo = {
  name: string;
  payload?: Record<string, unknown>;
  since?: number;
};

function groupMethodsByDomain(methods: MethodInfo[]) {
  const groups: Record<string, MethodInfo[]> = {};
  for (const method of methods) {
    const dot = method.name.indexOf(".");
    const domain = dot > 0 ? method.name.slice(0, dot) : "other";
    (groups[domain] ??= []).push(method);
  }
  const sortedEntries = Object.entries(groups)
    .slice()
    .toSorted(([left], [right]: [string, MethodInfo[]]) => left.localeCompare(right));
  return Object.fromEntries(
    sortedEntries.map(([domain, items]) => [
      domain,
      items
        .slice()
        .toSorted((left: MethodInfo, right: MethodInfo) => left.name.localeCompare(right.name)),
    ]),
  );
}

export function RestoredApiExplorerPanel() {
  const [payload, setPayload] = useState<DeckGoGatewayDescribeResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [tab, setTab] = useState<ExplorerTab>("methods");
  const [search, setSearch] = useState("");
  const [selectedMethodName, setSelectedMethodName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    void fetchGatewayDescribe()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setPayload(next);
        setLoadState("ready");
        setError("");
        const firstMethod =
          Object.keys(next.methods ?? {})
            .slice()
            .toSorted((left: string, right: string) => left.localeCompare(right))[0] ?? "";
        setSelectedMethodName((current) =>
          current && next.methods && current in next.methods ? current : firstMethod,
        );
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setLoadState("idle");
        setError(
          loadError instanceof Error ? loadError.message : "failed to load gateway describe",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const methods = useMemo<MethodInfo[]>(
    () =>
      Object.entries(payload?.methods ?? {})
        .map(([name, meta]) => ({
          name,
          scope: meta.scope || "unknown",
          params: meta.params,
          result: meta.result,
          since: meta.since,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [payload],
  );
  const events = useMemo<EventInfo[]>(
    () =>
      Object.entries(payload?.events ?? {})
        .map(([name, meta]) => ({
          name,
          payload: meta.payload,
          since: meta.since,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [payload],
  );
  const filteredMethods = useMemo(() => {
    if (!search.trim()) {
      return methods;
    }
    const query = search.trim().toLowerCase();
    return methods.filter(
      (method) =>
        method.name.toLowerCase().includes(query) || method.scope.toLowerCase().includes(query),
    );
  }, [methods, search]);
  const groupedMethods = useMemo(() => groupMethodsByDomain(filteredMethods), [filteredMethods]);
  const selectedMethod =
    methods.find((method) => method.name === selectedMethodName) ?? methods[0] ?? null;
  const untyped = payload?.untyped ?? [];

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Gateway API Explorer</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned explorer over the live `gateway.describe` contract. This replaces another
            placeholder with a real operator-facing inspection surface.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Describe {loadState}
              </span>
              <span className="deckgo-pill">{methods.length} methods</span>
              <span className="deckgo-pill">{events.length} events</span>
              <span className="deckgo-pill">{untyped.length} untyped</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="methods" value={methods.length} />
              <ShellStat label="events" value={events.length} />
              <ShellStat label="untyped" value={untyped.length} />
            </div>
            <div className="deckgo-pill-row">
              <button
                className={`deckgo-button ${tab === "methods" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("methods")}
              >
                Methods
              </button>
              <button
                className={`deckgo-button ${tab === "events" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("events")}
              >
                Events
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {tab === "methods" ? (
              <>
                <label className="deckgo-label">
                  <span>Search methods</span>
                  <input
                    className="deckgo-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="method name or scope"
                  />
                </label>
                <div className="deckgo-shell-list">
                  {Object.entries(groupedMethods).length === 0 ? (
                    <p className="deckgo-note">No methods match the current search.</p>
                  ) : (
                    Object.entries(groupedMethods).map(([domain, items]) => (
                      <div key={domain}>
                        <p className="deckgo-kicker" style={{ marginBottom: 8 }}>
                          {domain} ({items.length})
                        </p>
                        <ul className="deckgo-shell-list">
                          {items.map((method: MethodInfo) => (
                            <li key={method.name}>
                              <button
                                type="button"
                                className={`deckgo-selectable-card ${selectedMethod?.name === method.name ? "is-selected" : ""}`}
                                onClick={() => setSelectedMethodName(method.name)}
                              >
                                <strong>{method.name}</strong>
                                <div className="deckgo-meta">
                                  scope: {method.scope} | since: {method.since ?? "n/a"}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <ul className="deckgo-shell-list">
                {events.length === 0 ? (
                  <p className="deckgo-note">No events described.</p>
                ) : (
                  events.map((event) => (
                    <li key={event.name}>
                      <div className="deckgo-selectable-card">
                        <strong>{event.name}</strong>
                        <div className="deckgo-meta">since: {event.since ?? "n/a"}</div>
                        <JsonDetails title="Event payload" payload={event.payload ?? {}} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected method</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Keeps the first explorer slice focused on inspection: method scope plus params/result
            schema payloads.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedMethod ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Method</p>
                    <strong>{selectedMethod.name}</strong>
                    <p className="deckgo-note">scope: {selectedMethod.scope}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">since {selectedMethod.since ?? "n/a"}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="scope" value={selectedMethod.scope} />
                  <ShellStat label="since" value={selectedMethod.since ?? "n/a"} />
                </div>
                <JsonDetails title="Params schema" payload={selectedMethod.params ?? {}} />
                <JsonDetails title="Result schema" payload={selectedMethod.result ?? {}} />
              </>
            ) : (
              <p className="deckgo-note">Choose a method to inspect its schema payloads.</p>
            )}
            {untyped.length > 0 ? <JsonDetails title="Untyped methods" payload={untyped} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
