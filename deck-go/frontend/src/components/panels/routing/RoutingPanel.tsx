import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoActivityEvent,
  DeckGoRoutingAddResponse,
  DeckGoRoutingBinding,
  DeckGoRoutingMatch,
  DeckGoRoutingRemoveResponse,
  DeckGoRoutingSimulateResponse,
  DeckGoRoutingSimulationTier,
  DeckGoRoutingValidateResponse,
} from "../../../api";
import {
  addRoutingBinding,
  fetchActivityEvents,
  fetchRoutingBindings,
  patchDeckConfig,
  removeRoutingBinding,
  simulateRouting,
  validateRoutingBinding,
} from "../../../api";
import {
  navigateToAgent,
  navigateToChannel,
  navigateToChannelAccess,
  navigateToSession,
} from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { detectConflicts, type ConflictPair } from "../../../lib/detect-conflicts";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type RoutingTranslator = ReturnType<typeof useTranslations>;

type RoutingFilters = {
  agentId: string;
  channel: string;
  accountId: string;
};

type RoutingSimulationDraft = {
  channel: string;
  accountId: string;
  peerKind: "" | "direct" | "group" | "channel";
  peerId: string;
  guildId: string;
  teamId: string;
  memberRoleIds: string;
};

type RoutingBindingDraft = {
  agentId: string;
  channel: string;
  accountId: string;
  peerKind: "" | "direct" | "group" | "channel";
  peerId: string;
  guildId: string;
  teamId: string;
  roles: string;
  comment: string;
  position: string;
};

const DM_SCOPE_OPTIONS = [
  { value: "main", label: "main" },
  { value: "per-peer", label: "per-peer" },
  { value: "per-channel-peer", label: "per-channel-peer" },
  { value: "per-account-channel-peer", label: "per-account-channel-peer" },
] as const;

const DEFAULT_FILTERS: RoutingFilters = {
  agentId: "",
  channel: "",
  accountId: "",
};

const DEFAULT_SIMULATION_DRAFT: RoutingSimulationDraft = {
  channel: "telegram",
  accountId: "",
  peerKind: "",
  peerId: "",
  guildId: "",
  teamId: "",
  memberRoleIds: "",
};

const DEFAULT_BINDING_DRAFT: RoutingBindingDraft = {
  agentId: "",
  channel: "",
  accountId: "",
  peerKind: "",
  peerId: "",
  guildId: "",
  teamId: "",
  roles: "",
  comment: "",
  position: "",
};

function readRoutingNavigationTarget() {
  if (typeof window === "undefined") {
    return { agentId: "", channel: "", accountId: "" };
  }
  const params = new URL(window.location.href).searchParams;
  return {
    agentId: params.get("routingAgentId")?.trim() ?? "",
    channel: params.get("routingChannel")?.trim() ?? "",
    accountId: params.get("routingAccountId")?.trim() ?? "",
  };
}

function buildInitialFilters(): RoutingFilters {
  const target = readRoutingNavigationTarget();
  return {
    ...DEFAULT_FILTERS,
    agentId: target.agentId,
    channel: target.channel,
    accountId: target.accountId,
  };
}

function buildInitialSimulationDraft(): RoutingSimulationDraft {
  const target = readRoutingNavigationTarget();
  return {
    ...DEFAULT_SIMULATION_DRAFT,
    channel: target.channel || DEFAULT_SIMULATION_DRAFT.channel,
    accountId: target.accountId,
  };
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildRoutingMatch(draft: RoutingBindingDraft): DeckGoRoutingMatch {
  const roles = parseCommaList(draft.roles);
  return {
    channel: draft.channel.trim(),
    ...(draft.accountId.trim() ? { accountId: draft.accountId.trim() } : {}),
    ...(draft.peerKind && draft.peerId.trim()
      ? { peer: { kind: draft.peerKind, id: draft.peerId.trim() } }
      : {}),
    ...(draft.guildId.trim() ? { guildId: draft.guildId.trim() } : {}),
    ...(draft.teamId.trim() ? { teamId: draft.teamId.trim() } : {}),
    ...(roles.length > 0 ? { roles } : {}),
  };
}

function parsePosition(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function summarizeBindingMatch(
  binding: DeckGoRoutingBinding,
  labels: {
    account: string;
    channel: string;
    guild: string;
    peer: string;
    roles: string;
    team: string;
  },
) {
  const parts = [`${labels.channel} ${binding.match.channel}`];
  if (binding.match.accountId) {
    parts.push(`${labels.account} ${binding.match.accountId}`);
  }
  if (binding.match.peer) {
    parts.push(`${labels.peer} ${binding.match.peer.kind}:${binding.match.peer.id}`);
  }
  if (binding.match.guildId) {
    parts.push(`${labels.guild} ${binding.match.guildId}`);
  }
  if (binding.match.teamId) {
    parts.push(`${labels.team} ${binding.match.teamId}`);
  }
  if (binding.match.roles?.length) {
    parts.push(`${labels.roles} ${binding.match.roles.join(", ")}`);
  }
  return parts.join(" | ");
}

function summarizeSimulationTier(t: RoutingTranslator, tier: DeckGoRoutingSimulationTier) {
  if (tier.matched) {
    return t("matched");
  }
  return tier.checked ? t("checked") : t("skipped");
}

function buildConflictMap(conflicts: ConflictPair[]) {
  const byBinding = new Map<string, ConflictPair[]>();
  for (const conflict of conflicts) {
    byBinding.set(conflict.bindingA, [...(byBinding.get(conflict.bindingA) ?? []), conflict]);
    byBinding.set(conflict.bindingB, [...(byBinding.get(conflict.bindingB) ?? []), conflict]);
  }
  return byBinding;
}

function describeConflict(t: RoutingTranslator, bindingId: string, conflict: ConflictPair) {
  const otherBindingId = conflict.bindingA === bindingId ? conflict.bindingB : conflict.bindingA;
  return t("conflictWith", { type: conflict.overlapType, bindingId: otherBindingId });
}

function isKnownDmScope(value: string) {
  return DM_SCOPE_OPTIONS.some((option) => option.value === value);
}

export function RoutingPanel() {
  const t = useTranslations("routing");
  const tc = useTranslations("common");
  const ui = useDeckUI();
  const initialSimulationDraft = useMemo(() => buildInitialSimulationDraft(), []);
  const [filters, setFilters] = useState(buildInitialFilters);
  const [bindingDraft, setBindingDraft] = useState(DEFAULT_BINDING_DRAFT);
  const [simulationDraft, setSimulationDraft] = useState(initialSimulationDraft);
  const [bindings, setBindings] = useState<DeckGoRoutingBinding[]>([]);
  const [routingActivityEvents, setRoutingActivityEvents] = useState<DeckGoActivityEvent[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [dmScope, setDmScope] = useState("");
  const [scopeDraft, setScopeDraft] = useState("main");
  const [configHash, setConfigHash] = useState("");
  const [selectedBindingId, setSelectedBindingId] = useState("");
  const [simulationResult, setSimulationResult] = useState<DeckGoRoutingSimulateResponse | null>(
    null,
  );
  const [validationResult, setValidationResult] = useState<DeckGoRoutingValidateResponse | null>(
    null,
  );
  const [mutationResult, setMutationResult] = useState<
    DeckGoRoutingAddResponse | DeckGoRoutingRemoveResponse | null
  >(null);
  const [scopeResult, setScopeResult] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "simulating" | "validating" | "adding" | "removing" | "reordering" | "scope"
  >("idle");
  const [error, setError] = useState("");
  const [routingActivityError, setRoutingActivityError] = useState("");

  const refresh = async (preferredBindingId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchRoutingBindings(filters);
      const nextBindings = next.bindings ?? [];
      setBindings(nextBindings);
      setDefaultAgentId(next.defaultAgentId || "");
      setDmScope(next.dmScope || "");
      setScopeDraft(next.dmScope || "main");
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
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    }
  };

  const loadRoutingActivity = async () => {
    setRoutingActivityError("");
    try {
      const next = await fetchActivityEvents(20);
      setRoutingActivityEvents(
        (next.events ?? [])
          .filter(
            (event) =>
              event.type.includes("routing") ||
              event.type.includes("route") ||
              event.type === "agent" ||
              event.type === "chat" ||
              Boolean(event.agentId),
          )
          .slice()
          .toSorted((left, right) => right.timestamp - left.timestamp)
          .slice(0, 10),
      );
    } catch (loadError) {
      setRoutingActivityError(gatewayNotConfiguredValue(loadError, t("activityLoadFailed")));
    }
  };

  useEffect(() => {
    void refresh();
    void loadRoutingActivity();
  }, []);

  const selectedBinding =
    bindings.find((binding) => binding.id === selectedBindingId) ?? bindings[0] ?? null;

  const tiers = useMemo(
    () =>
      simulationResult?.tiers
        ?.slice()
        .toSorted((left, right) => left.tier.localeCompare(right.tier)) ?? [],
    [simulationResult],
  );
  const conflictPairs = useMemo(() => detectConflicts(bindings), [bindings]);
  const conflictMap = useMemo(() => buildConflictMap(conflictPairs), [conflictPairs]);
  const selectedBindingIndex = selectedBinding
    ? bindings.findIndex((binding) => binding.id === selectedBinding.id)
    : -1;
  const selectedBindingChannelId = selectedBinding?.match.channel.trim() ?? "";
  const selectedBindingAccountId = selectedBinding?.match.accountId?.trim() ?? "";
  const simulationChannelId = simulationDraft.channel.trim();
  const simulationAccountId = simulationDraft.accountId.trim();
  const emptyLabel = t("notAvailable");
  const routingActivityNotConfigured = isGatewayNotConfiguredValue(routingActivityError);
  const bindingMatchLabels = {
    account: t("dimAccountId"),
    channel: t("dimChannel"),
    guild: t("dimGuildId"),
    peer: t("dimPeer"),
    roles: t("dimRoles"),
    team: t("dimTeamId"),
  };

  const runSimulation = async () => {
    if (!simulationDraft.channel.trim()) {
      setError(t("simulationChannelRequired"));
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
        peer:
          simulationDraft.peerKind && simulationDraft.peerId.trim()
            ? { kind: simulationDraft.peerKind, id: simulationDraft.peerId.trim() }
            : undefined,
        guildId: simulationDraft.guildId.trim() || undefined,
        teamId: simulationDraft.teamId.trim() || undefined,
        memberRoleIds: memberRoleIds.length ? memberRoleIds : undefined,
      });
      setSimulationResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("simulateFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const resetSimulation = () => {
    setSimulationDraft(initialSimulationDraft);
    setSimulationResult(null);
  };

  const loadSelectedBindingIntoSimulation = () => {
    if (!selectedBinding) {
      setError(t("selectBindingBeforeSimulation"));
      return;
    }
    setSimulationDraft({
      channel: selectedBinding.match.channel,
      accountId: selectedBinding.match.accountId ?? "",
      peerKind: selectedBinding.match.peer?.kind ?? "",
      peerId: selectedBinding.match.peer?.id ?? "",
      guildId: selectedBinding.match.guildId ?? "",
      teamId: selectedBinding.match.teamId ?? "",
      memberRoleIds: selectedBinding.match.roles?.join(", ") ?? "",
    });
    setSimulationResult(null);
    setError("");
  };

  const validateBinding = async () => {
    if (!bindingDraft.agentId.trim() || !bindingDraft.channel.trim()) {
      setError(t("bindingAgentChannelRequired"));
      return;
    }
    setActionState("validating");
    try {
      const result = await validateRoutingBinding({
        agentId: bindingDraft.agentId.trim(),
        match: buildRoutingMatch(bindingDraft),
      });
      setValidationResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("validateFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const addBinding = async () => {
    if (!bindingDraft.agentId.trim() || !bindingDraft.channel.trim()) {
      setError(t("bindingAgentChannelRequired"));
      return;
    }
    if (!configHash) {
      setError(t("configHashRequiredAdd"));
      return;
    }
    setActionState("adding");
    try {
      const result = await addRoutingBinding({
        agentId: bindingDraft.agentId.trim(),
        match: buildRoutingMatch(bindingDraft),
        baseHash: configHash,
        comment: bindingDraft.comment.trim() || undefined,
        position: parsePosition(bindingDraft.position),
      });
      setMutationResult(result);
      setValidationResult(null);
      setBindingDraft(DEFAULT_BINDING_DRAFT);
      setError("");
      await refresh(result.binding.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("addFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const removeSelectedBinding = async () => {
    if (!selectedBinding || !configHash) {
      setError(t("selectBindingBeforeRemove"));
      return;
    }
    setActionState("removing");
    try {
      const result = await removeRoutingBinding({
        id: selectedBinding.id,
        baseHash: configHash,
      });
      setMutationResult(result);
      setValidationResult(null);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("removeFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const reorderSelectedBinding = async (direction: -1 | 1) => {
    if (!selectedBinding || !configHash) {
      setError(t("selectBindingBeforeReorder"));
      return;
    }
    const nextPosition = selectedBindingIndex + direction;
    if (selectedBindingIndex < 0 || nextPosition < 0 || nextPosition >= bindings.length) {
      setError(t("bindingAtEdge"));
      return;
    }
    setActionState("reordering");
    try {
      const removeResult = await removeRoutingBinding({
        id: selectedBinding.id,
        baseHash: configHash,
      });
      const addResult = await addRoutingBinding({
        agentId: selectedBinding.agentId,
        match: selectedBinding.match,
        baseHash: removeResult.configHash,
        comment: selectedBinding.comment,
        position: nextPosition,
      });
      setMutationResult(addResult);
      setValidationResult(null);
      setError("");
      await refresh(addResult.binding.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("reorderFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const patchDmScope = async () => {
    if (!scopeDraft.trim()) {
      setError(t("dmScopeRequired"));
      return;
    }
    if (!configHash) {
      setError(t("configHashRequiredScope"));
      return;
    }
    setActionState("scope");
    try {
      const nextScope = scopeDraft.trim();
      const result = await patchDeckConfig({ session: { dmScope: nextScope } }, configHash);
      setScopeResult(t("dmScopeUpdated", { scope: nextScope }));
      setDmScope(nextScope);
      setConfigHash(result.hash || result.baseHash || configHash);
      setError("");
      await refresh(selectedBindingId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("dmScopePatchFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-routing">
      <div className="deckgo-column deck-ui-routing-column">
        <article className="deckgo-card is-float deck-ui-routing-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("description")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-routing-body">
            <div className="deckgo-pill-row deck-ui-routing-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="deckgo-pill">
                {t("defaultPill", { agent: defaultAgentId || emptyLabel })}
              </span>
              <span className="deckgo-pill">
                {t("dmScopePill", { scope: dmScope || emptyLabel })}
              </span>
              <span
                className={`deckgo-pill ${conflictPairs.length > 0 ? "is-warning" : "is-muted"}`}
              >
                {t("conflictCount", { count: conflictPairs.length })}
              </span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-routing-stats">
              <ShellStat label={t("bindingsStat")} value={bindings.length} />
              <ShellStat label={t("dmScope")} value={dmScope || emptyLabel} />
              <ShellStat label={t("configHash")} value={configHash || emptyLabel} />
            </div>
            <div className="deckgo-surface-tile deck-ui-routing-surface">
              <p className="deckgo-surface-label">{t("dmScopeStrategy")}</p>
              <div className="deckgo-actions deck-ui-routing-actions">
                <select
                  aria-label={t("dmScopeStrategy")}
                  className="deckgo-input deck-ui-routing-input"
                  value={scopeDraft}
                  onChange={(event) => setScopeDraft(event.target.value)}
                >
                  {scopeDraft && !isKnownDmScope(scopeDraft) ? (
                    <option value={scopeDraft}>{scopeDraft}</option>
                  ) : null}
                  {DM_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="deckgo-button deck-ui-routing-button"
                  disabled={actionState !== "idle"}
                  onClick={() => void patchDmScope()}
                  type="button"
                >
                  {actionState === "scope" ? t("patchingDmScope") : t("patchDmScope")}
                </button>
              </div>
              {scopeResult ? (
                <p className="deckgo-note deck-ui-routing-result">{scopeResult}</p>
              ) : null}
            </div>
            <div className="deckgo-surface-tile deck-ui-routing-surface">
              <p className="deckgo-surface-label">{t("filterBindings")}</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-routing-form-grid">
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={filters.agentId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, agentId: event.target.value }))
                  }
                  placeholder="agent id"
                  aria-label={t("agentId")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={filters.channel}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, channel: event.target.value }))
                  }
                  placeholder="channel"
                  aria-label={t("dimChannel")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={filters.accountId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, accountId: event.target.value }))
                  }
                  placeholder="account id"
                  aria-label={t("dimAccountId")}
                />
              </div>
              <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                <button
                  className="deckgo-button deck-ui-routing-button"
                  type="button"
                  onClick={() => void refresh()}
                >
                  {t("refreshRouting")}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-routing-error">{error}</p> : null}
            <div className="deckgo-surface-tile deck-ui-routing-surface">
              <p className="deckgo-surface-label">{t("addOrValidateBinding")}</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-routing-form-grid">
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.agentId}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, agentId: event.target.value }))
                  }
                  aria-label={t("bindingAgentId")}
                  placeholder={t("bindingAgentIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.channel}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  aria-label={t("bindingChannel")}
                  placeholder={t("bindingChannelPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.accountId}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, accountId: event.target.value }))
                  }
                  aria-label={t("bindingAccountId")}
                  placeholder={t("bindingAccountIdPlaceholder")}
                />
                <select
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.peerKind}
                  onChange={(event) =>
                    setBindingDraft((current) => ({
                      ...current,
                      peerKind: event.target.value as RoutingBindingDraft["peerKind"],
                    }))
                  }
                  aria-label={t("bindingPeerKind")}
                >
                  <option value="">{t("noPeer")}</option>
                  <option value="direct">{t("directPeer")}</option>
                  <option value="group">{t("groupPeer")}</option>
                  <option value="channel">{t("channelPeer")}</option>
                </select>
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.peerId}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, peerId: event.target.value }))
                  }
                  aria-label={t("bindingPeerId")}
                  placeholder={t("bindingPeerIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.guildId}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, guildId: event.target.value }))
                  }
                  aria-label={t("bindingGuildId")}
                  placeholder={t("bindingGuildIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.teamId}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, teamId: event.target.value }))
                  }
                  aria-label={t("bindingTeamId")}
                  placeholder={t("bindingTeamIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.roles}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, roles: event.target.value }))
                  }
                  aria-label={t("bindingRoles")}
                  placeholder={t("bindingRolesPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.comment}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, comment: event.target.value }))
                  }
                  aria-label={t("bindingComment")}
                  placeholder={t("bindingCommentPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={bindingDraft.position}
                  inputMode="numeric"
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, position: event.target.value }))
                  }
                  aria-label={t("bindingPosition")}
                  placeholder={t("bindingPositionPlaceholder")}
                />
              </div>
              <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                <button
                  className="deckgo-button deck-ui-routing-button"
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={() => void validateBinding()}
                >
                  {actionState === "validating" ? t("validating") : t("validateBinding")}
                </button>
                <button
                  className="deckgo-button deck-ui-routing-button is-primary"
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={() => void addBinding()}
                >
                  {actionState === "adding" ? t("addingBinding") : t("addBindingAction")}
                </button>
              </div>
              {validationResult ? (
                <div className="deckgo-pill-row deck-ui-routing-status-row deck-ui-routing-actions-offset">
                  <span
                    className={`deckgo-pill ${validationResult.ok ? "is-positive" : "is-muted"}`}
                  >
                    {t("validationResult", {
                      state: validationResult.ok ? t("ok") : t("blocked"),
                    })}
                  </span>
                  <span className="deckgo-pill">
                    {t("tierValue", { tier: validationResult.tier })}
                  </span>
                  <span className="deckgo-pill">
                    {t("conflictsValue", { count: validationResult.conflicts.length })}
                  </span>
                </div>
              ) : null}
            </div>
            {bindings.length === 0 ? (
              <p className="deckgo-note deck-ui-routing-empty">{t("noBindingsLoaded")}</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-routing-list">
                {bindings.map((binding) => {
                  const conflicts = conflictMap.get(binding.id) ?? [];
                  return (
                    <li key={binding.id}>
                      <button
                        type="button"
                        className={`deckgo-selectable-card deck-ui-routing-row ${selectedBinding?.id === binding.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedBindingId(binding.id)}
                      >
                        <strong>{binding.agentId}</strong>
                        <div className="deckgo-meta">
                          {t("tier")}: {binding.tier} | {t("bindingId")}: {binding.id}
                        </div>
                        <div className="deckgo-meta">
                          {summarizeBindingMatch(binding, bindingMatchLabels)}
                        </div>
                        {conflicts.length > 0 ? (
                          <div className="deckgo-meta">
                            {t("conflictsValue", { count: conflicts.length })}:{" "}
                            {conflicts
                              .map((conflict) => describeConflict(t, binding.id, conflict))
                              .join("; ")}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-routing-column">
        <article className="deckgo-card is-float deck-ui-routing-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("routingDetail")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("routingDetailDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-routing-body">
            {selectedBinding ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-routing-hero">
                  <div>
                    <p className="deckgo-kicker">{t("selectedBinding")}</p>
                    <strong>{selectedBinding.agentId}</strong>
                    <p className="deckgo-note">{selectedBinding.id}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-routing-status-row">
                    <span className="deckgo-pill">{selectedBinding.tier}</span>
                    <span className="deckgo-pill">{selectedBinding.match.channel}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-routing-detail-stats">
                  <ShellStat label={t("agent")} value={selectedBinding.agentId} />
                  <ShellStat label={t("tier")} value={selectedBinding.tier} />
                </div>
                {(conflictMap.get(selectedBinding.id) ?? []).length > 0 ? (
                  <div className="deckgo-pill-row deck-ui-routing-status-row deck-ui-routing-actions-offset">
                    {(conflictMap.get(selectedBinding.id) ?? []).map((conflict) => (
                      <span
                        key={`${conflict.bindingA}:${conflict.bindingB}`}
                        className="deckgo-pill is-warning"
                      >
                        {t("conflict")} {describeConflict(t, selectedBinding.id, conflict)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={actionState !== "idle"}
                    onClick={loadSelectedBindingIntoSimulation}
                  >
                    {t("useAsSimulation")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={!selectedBinding.agentId.trim()}
                    onClick={() => navigateToAgent(ui, selectedBinding.agentId)}
                  >
                    {t("openBindingAgent")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={!selectedBindingChannelId}
                    onClick={() => navigateToChannel(ui, selectedBindingChannelId)}
                  >
                    {t("openBindingChannel")}
                  </button>
                  {selectedBindingChannelId === "wecom" && selectedBindingAccountId ? (
                    <button
                      className="deckgo-button deck-ui-routing-button"
                      type="button"
                      onClick={() =>
                        navigateToChannelAccess(
                          ui,
                          selectedBindingChannelId,
                          selectedBindingAccountId,
                        )
                      }
                    >
                      {t("openBindingAccess")}
                    </button>
                  ) : null}
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={actionState !== "idle" || selectedBindingIndex <= 0}
                    onClick={() => void reorderSelectedBinding(-1)}
                  >
                    {actionState === "reordering" ? t("reordering") : t("moveUp")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={
                      actionState !== "idle" ||
                      selectedBindingIndex < 0 ||
                      selectedBindingIndex >= bindings.length - 1
                    }
                    onClick={() => void reorderSelectedBinding(1)}
                  >
                    {actionState === "reordering" ? t("reordering") : t("moveDown")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button is-danger"
                    type="button"
                    disabled={actionState !== "idle"}
                    onClick={() => void removeSelectedBinding()}
                  >
                    {actionState === "removing" ? t("removingBinding") : t("removeBinding")}
                  </button>
                </div>
                <JsonDetails title={t("bindingPayload")} payload={selectedBinding} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-routing-empty">{t("chooseBinding")}</p>
            )}

            <div className="deckgo-surface-tile deck-ui-routing-surface">
              <p className="deckgo-surface-label">{t("simulateRouteSelection")}</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-routing-form-grid">
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.channel}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  aria-label={t("simulationChannel")}
                  placeholder={t("channelPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.accountId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, accountId: event.target.value }))
                  }
                  aria-label={t("simulationAccountId")}
                  placeholder={t("accountIdPlaceholder")}
                />
                <select
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.peerKind}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({
                      ...current,
                      peerKind: event.target.value as RoutingSimulationDraft["peerKind"],
                    }))
                  }
                  aria-label={t("simulationPeerKind")}
                >
                  <option value="">{t("noPeer")}</option>
                  <option value="direct">{t("directPeer")}</option>
                  <option value="group">{t("groupPeer")}</option>
                  <option value="channel">{t("channelPeer")}</option>
                </select>
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.peerId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, peerId: event.target.value }))
                  }
                  aria-label={t("simulationPeerId")}
                  placeholder={t("peerIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.guildId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, guildId: event.target.value }))
                  }
                  aria-label={t("simulationGuildId")}
                  placeholder={t("guildIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.teamId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, teamId: event.target.value }))
                  }
                  aria-label={t("simulationTeamId")}
                  placeholder={t("teamIdPlaceholder")}
                />
                <input
                  className="deckgo-input deck-ui-routing-input"
                  value={simulationDraft.memberRoleIds}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({
                      ...current,
                      memberRoleIds: event.target.value,
                    }))
                  }
                  aria-label={t("simulationRoles")}
                  placeholder={t("roleIdsPlaceholder")}
                />
              </div>
              <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                <button
                  className="deckgo-button deck-ui-routing-button is-primary"
                  type="button"
                  onClick={() => void runSimulation()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "simulating" ? t("simulating") : t("simulate")}
                </button>
                <button
                  className="deckgo-button deck-ui-routing-button"
                  type="button"
                  onClick={resetSimulation}
                >
                  {t("resetSimulation")}
                </button>
              </div>
            </div>

            {simulationResult ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-routing-hero">
                  <div>
                    <p className="deckgo-kicker">{t("simulationResult")}</p>
                    <strong>{simulationResult.agentId || t("noAgentMatched")}</strong>
                    <p className="deckgo-note">
                      {t("sessionValue", { session: simulationResult.sessionKey || emptyLabel })}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-routing-status-row">
                    <span className="deckgo-pill">
                      {t("matchedByValue", { tier: simulationResult.matchedBy })}
                    </span>
                    <span className="deckgo-pill">{t("tiersCount", { count: tiers.length })}</span>
                  </div>
                </div>
                <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={!simulationResult.agentId?.trim()}
                    onClick={() => navigateToAgent(ui, simulationResult.agentId ?? "")}
                  >
                    {t("openSimulationAgent")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={!simulationResult.sessionKey?.trim()}
                    onClick={() => navigateToSession(ui, simulationResult.sessionKey ?? "")}
                  >
                    {t("openSimulationSession")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-routing-button"
                    type="button"
                    disabled={!simulationChannelId}
                    onClick={() => navigateToChannel(ui, simulationChannelId)}
                  >
                    {t("openSimulationChannel")}
                  </button>
                  {simulationChannelId === "wecom" && simulationAccountId ? (
                    <button
                      className="deckgo-button deck-ui-routing-button"
                      type="button"
                      onClick={() =>
                        navigateToChannelAccess(ui, simulationChannelId, simulationAccountId)
                      }
                    >
                      {t("openSimulationAccess")}
                    </button>
                  ) : null}
                </div>
                <ul className="deckgo-shell-list deck-ui-routing-list">
                  {tiers.map((tier) => (
                    <li key={tier.tier}>
                      <div className="deckgo-selectable-card deck-ui-routing-row">
                        <strong>{tier.tier}</strong>
                        <div className="deckgo-meta">{summarizeSimulationTier(t, tier)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <JsonDetails title={t("simulationPayload")} payload={simulationResult} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-routing-empty">{t("runSimulationPrompt")}</p>
            )}
            <div className="deckgo-surface-tile deck-ui-routing-surface">
              <p className="deckgo-surface-label">{t("activityFeed")}</p>
              <p className="deckgo-note">{t("activityFeedDescription")}</p>
              <div className="deckgo-actions deck-ui-routing-actions deck-ui-routing-actions-offset">
                <button
                  className="deckgo-button deck-ui-routing-button"
                  type="button"
                  onClick={() => void loadRoutingActivity()}
                >
                  {t("refreshActivity")}
                </button>
              </div>
              {routingActivityNotConfigured ? (
                <GatewayNotConfiguredEmptyState className="deck-ui-routing-surface" />
              ) : routingActivityEvents.length > 0 ? (
                <ul className="deckgo-shell-list deck-ui-routing-list deck-ui-routing-list-offset">
                  {routingActivityEvents.map((event) => (
                    <li key={event.id}>
                      <div className="deckgo-selectable-card deck-ui-routing-row">
                        <strong>{event.description}</strong>
                        <div className="deckgo-meta">
                          {event.type} | {event.agentName || event.agentId || t("systemActor")}
                        </div>
                        <div className="deckgo-meta">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="deckgo-note deck-ui-routing-empty">{t("noRecentActivity")}</p>
              )}
              {routingActivityError && !routingActivityNotConfigured ? (
                <p className="deckgo-note deck-ui-routing-error">{routingActivityError}</p>
              ) : null}
            </div>
            {mutationResult ? (
              <JsonDetails title={t("routingMutation")} payload={mutationResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
