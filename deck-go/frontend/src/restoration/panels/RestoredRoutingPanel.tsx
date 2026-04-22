import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoRoutingBinding,
  DeckGoRoutingSimulateResponse,
  DeckGoRoutingSimulationTier,
} from "../../api";
import { fetchRoutingBindings, simulateRouting } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

type RoutingFilters = {
  agentId: string;
  channel: string;
  accountId: string;
};

type RoutingSimulationDraft = {
  channel: string;
  accountId: string;
  guildId: string;
  teamId: string;
  memberRoleIds: string;
};

const DEFAULT_FILTERS: RoutingFilters = {
  agentId: "",
  channel: "",
  accountId: "",
};

const DEFAULT_SIMULATION_DRAFT: RoutingSimulationDraft = {
  channel: "telegram",
  accountId: "",
  guildId: "",
  teamId: "",
  memberRoleIds: "",
};

function summarizeBindingMatch(binding: DeckGoRoutingBinding) {
  const parts = [`channel ${binding.match.channel}`];
  if (binding.match.accountId) {
    parts.push(`account ${binding.match.accountId}`);
  }
  if (binding.match.peer) {
    parts.push(`peer ${binding.match.peer.kind}:${binding.match.peer.id}`);
  }
  if (binding.match.guildId) {
    parts.push(`guild ${binding.match.guildId}`);
  }
  if (binding.match.teamId) {
    parts.push(`team ${binding.match.teamId}`);
  }
  if (binding.match.roles?.length) {
    parts.push(`roles ${binding.match.roles.join(", ")}`);
  }
  return parts.join(" | ");
}

function summarizeSimulationTier(tier: DeckGoRoutingSimulationTier) {
  if (tier.matched) {
    return "matched";
  }
  return tier.checked ? "checked" : "skipped";
}

export function RestoredRoutingPanel() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [simulationDraft, setSimulationDraft] = useState(DEFAULT_SIMULATION_DRAFT);
  const [bindings, setBindings] = useState<DeckGoRoutingBinding[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [dmScope, setDmScope] = useState("");
  const [configHash, setConfigHash] = useState("");
  const [selectedBindingId, setSelectedBindingId] = useState("");
  const [simulationResult, setSimulationResult] = useState<DeckGoRoutingSimulateResponse | null>(
    null,
  );
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "simulating">("idle");
  const [error, setError] = useState("");

  const refresh = async (preferredBindingId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchRoutingBindings(filters);
      const nextBindings = next.bindings ?? [];
      setBindings(nextBindings);
      setDefaultAgentId(next.defaultAgentId || "");
      setDmScope(next.dmScope || "");
      setConfigHash(next.configHash || "");
      setLoadState("ready");
      setError("");
      const fallbackId = preferredBindingId?.trim() || nextBindings[0]?.id || "";
      setSelectedBindingId((current) =>
        nextBindings.some((binding) => binding.id === current)
          ? current
          : nextBindings.some((binding) => binding.id === fallbackId)
            ? fallbackId
            : nextBindings[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load routing");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectedBinding =
    bindings.find((binding) => binding.id === selectedBindingId) ?? bindings[0] ?? null;

  const tiers = useMemo(
    () =>
      simulationResult?.tiers?.slice().sort((left, right) => left.tier.localeCompare(right.tier)) ??
      [],
    [simulationResult],
  );

  const runSimulation = async () => {
    if (!simulationDraft.channel.trim()) {
      setError("simulation channel is required");
      return;
    }
    setActionState("simulating");
    try {
      const memberRoleIds = simulationDraft.memberRoleIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const result = await simulateRouting({
        channel: simulationDraft.channel.trim(),
        accountId: simulationDraft.accountId.trim() || undefined,
        guildId: simulationDraft.guildId.trim() || undefined,
        teamId: simulationDraft.teamId.trim() || undefined,
        memberRoleIds: memberRoleIds.length ? memberRoleIds : undefined,
      });
      setSimulationResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "routing simulate failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Routing</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned routing surface for live bindings plus route simulation.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Routing {loadState}
              </span>
              <span className="deckgo-pill">default {defaultAgentId || "n/a"}</span>
              <span className="deckgo-pill">dm scope {dmScope || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="bindings" value={bindings.length} />
              <ShellStat label="dm scope" value={dmScope || "n/a"} />
              <ShellStat label="config hash" value={configHash || "n/a"} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Filter bindings</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={filters.agentId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, agentId: event.target.value }))
                  }
                  placeholder="agent id"
                />
                <input
                  className="deckgo-input"
                  value={filters.channel}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, channel: event.target.value }))
                  }
                  placeholder="channel"
                />
                <input
                  className="deckgo-input"
                  value={filters.accountId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, accountId: event.target.value }))
                  }
                  placeholder="account id"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button className="deckgo-button" type="button" onClick={() => void refresh()}>
                  Refresh routing
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {bindings.length === 0 ? (
              <p className="deckgo-note">No routing bindings loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {bindings.map((binding) => (
                  <li key={binding.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedBinding?.id === binding.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedBindingId(binding.id)}
                    >
                      <strong>{binding.agentId}</strong>
                      <div className="deckgo-meta">
                        tier: {binding.tier} | binding id: {binding.id}
                      </div>
                      <div className="deckgo-meta">{summarizeBindingMatch(binding)}</div>
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
            <h2 className="deckgo-card-title">Routing detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays operator-first: inspect the live binding set, then simulate match order
            without importing the old editor complexity.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedBinding ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Selected binding</p>
                    <strong>{selectedBinding.agentId}</strong>
                    <p className="deckgo-note">{selectedBinding.id}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedBinding.tier}</span>
                    <span className="deckgo-pill">{selectedBinding.match.channel}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="agent" value={selectedBinding.agentId} />
                  <ShellStat label="tier" value={selectedBinding.tier} />
                </div>
                <JsonDetails title="Binding payload" payload={selectedBinding} />
              </>
            ) : (
              <p className="deckgo-note">Choose a binding to inspect it.</p>
            )}

            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Simulate route selection</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={simulationDraft.channel}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  placeholder="channel"
                />
                <input
                  className="deckgo-input"
                  value={simulationDraft.accountId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, accountId: event.target.value }))
                  }
                  placeholder="account id"
                />
                <input
                  className="deckgo-input"
                  value={simulationDraft.guildId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, guildId: event.target.value }))
                  }
                  placeholder="guild id"
                />
                <input
                  className="deckgo-input"
                  value={simulationDraft.teamId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, teamId: event.target.value }))
                  }
                  placeholder="team id"
                />
                <input
                  className="deckgo-input"
                  value={simulationDraft.memberRoleIds}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({
                      ...current,
                      memberRoleIds: event.target.value,
                    }))
                  }
                  placeholder="role ids, comma separated"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void runSimulation()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "simulating" ? "Simulating" : "Simulate"}
                </button>
              </div>
            </div>

            {simulationResult ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Simulation result</p>
                    <strong>{simulationResult.agentId || "no agent matched"}</strong>
                    <p className="deckgo-note">session {simulationResult.sessionKey || "n/a"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">matched by {simulationResult.matchedBy}</span>
                    <span className="deckgo-pill">{tiers.length} tiers</span>
                  </div>
                </div>
                <ul className="deckgo-shell-list">
                  {tiers.map((tier) => (
                    <li key={tier.tier}>
                      <div className="deckgo-selectable-card">
                        <strong>{tier.tier}</strong>
                        <div className="deckgo-meta">{summarizeSimulationTier(tier)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <JsonDetails title="Simulation payload" payload={simulationResult} />
              </>
            ) : (
              <p className="deckgo-note">Run a simulation to inspect routing tier evaluation.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
