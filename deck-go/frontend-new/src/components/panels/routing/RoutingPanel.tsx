import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  routingActivityQueryOptions,
  routingBindingsQueryOptions,
  useAddRoutingBindingMutation,
  usePatchRoutingDmScopeMutation,
  useRemoveRoutingBindingMutation,
  useSimulateRoutingMutation,
  useValidateRoutingBindingMutation,
} from "../../../data/modules/routing";
import {
  navigateToAgent,
  navigateToChannel,
  navigateToChannelAccess,
  navigateToSession,
} from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  Badge,
  Button,
  Card,
  Chip,
  Input,
  Select,
  Spinner,
  Textarea,
} from "../../../design-system/atoms";
import { useTranslations } from "../../../i18n/provider";
import { detectConflicts, type ConflictPair } from "../../../lib/detect-conflicts";
import {
  GatewayNotConfiguredEmptyState,
  gatewayNotConfiguredValue,
  isGatewayNotConfiguredValue,
} from "../../runtime/GatewayNotConfiguredEmptyState";
import { JsonDetails } from "../../shared/ShellComponents";
import "./routing-panel.css";

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

type PendingRoutingAction =
  | {
      kind: "scope";
      label: string;
      hint: string;
      nextScope: string;
      baseHash: string;
    }
  | {
      kind: "add";
      label: string;
      hint: string;
      draft: RoutingBindingDraft;
      baseHash: string;
    }
  | {
      kind: "remove";
      label: string;
      hint: string;
      binding: DeckGoRoutingBinding;
      baseHash: string;
    }
  | {
      kind: "move";
      label: string;
      hint: string;
      binding: DeckGoRoutingBinding;
      direction: -1 | 1;
      baseHash: string;
    };

type MetricTileProps = {
  label: string;
  value: string | number;
  hint?: string;
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

function shortConfigHash(value: string) {
  return value ? `${value.slice(0, 8)}...` : "n/a";
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

function statusVariant(loadState: PanelState) {
  if (loadState === "ready") {
    return "ok";
  }
  if (loadState === "loading") {
    return "running";
  }
  return "neutral";
}

function simulationTierVariant(tier: DeckGoRoutingSimulationTier) {
  if (tier.matched) {
    return "ok";
  }
  return tier.checked ? "neutral" : "warn";
}

function MetricTile({ label, value, hint }: MetricTileProps) {
  return (
    <article className="routing-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function MatchChipRow(props: {
  binding: DeckGoRoutingBinding;
  labels: {
    account: string;
    channel: string;
    guild: string;
    peer: string;
    roles: string;
    team: string;
  };
}) {
  const { binding, labels } = props;
  return (
    <div className="routing-match-chips">
      <Chip>
        <b>{labels.channel}</b> {binding.match.channel}
      </Chip>
      {binding.match.accountId ? (
        <Chip>
          <b>{labels.account}</b> {binding.match.accountId}
        </Chip>
      ) : null}
      {binding.match.peer ? (
        <Chip>
          <b>{labels.peer}</b> {binding.match.peer.kind}:{binding.match.peer.id}
        </Chip>
      ) : null}
      {binding.match.guildId ? (
        <Chip>
          <b>{labels.guild}</b> {binding.match.guildId}
        </Chip>
      ) : null}
      {binding.match.teamId ? (
        <Chip>
          <b>{labels.team}</b> {binding.match.teamId}
        </Chip>
      ) : null}
      {binding.match.roles?.length ? (
        <Chip>
          <b>{labels.roles}</b> {binding.match.roles.join(", ")}
        </Chip>
      ) : null}
    </div>
  );
}

export function RoutingPanel() {
  const t = useTranslations("routing");
  const tc = useTranslations("common");
  const ui = useDeckUI();
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const addRoutingBindingMutation = useAddRoutingBindingMutation();
  const removeRoutingBindingMutation = useRemoveRoutingBindingMutation();
  const patchRoutingDmScopeMutation = usePatchRoutingDmScopeMutation();
  const simulateRoutingMutation = useSimulateRoutingMutation();
  const validateRoutingBindingMutation = useValidateRoutingBindingMutation();
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
  const [showBindingDraft, setShowBindingDraft] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingRoutingAction | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "simulating" | "validating" | "adding" | "removing" | "reordering" | "scope"
  >("idle");
  const [error, setError] = useState("");
  const [routingActivityError, setRoutingActivityError] = useState("");

  const refresh = async (preferredBindingId?: string) => {
    setLoadState("loading");
    try {
      const next = await queryClient.fetchQuery({
        ...routingBindingsQueryOptions(bff, filters),
        staleTime: 0,
      });
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
      const next = await queryClient.fetchQuery({
        ...routingActivityQueryOptions(bff, 20),
        staleTime: 0,
      });
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
      const memberRoleIds = parseCommaList(simulationDraft.memberRoleIds);
      const result = await simulateRoutingMutation.mutateAsync({
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
      const result = await validateRoutingBindingMutation.mutateAsync({
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

  const addBinding = () => {
    if (!bindingDraft.agentId.trim() || !bindingDraft.channel.trim()) {
      setError(t("bindingAgentChannelRequired"));
      return;
    }
    if (!configHash) {
      setError(t("configHashRequiredAdd"));
      return;
    }
    setPendingAction({
      kind: "add",
      label: t("addBindingAction"),
      hint: t("confirmAddHint", {
        agentId: bindingDraft.agentId.trim(),
        channel: bindingDraft.channel.trim(),
        hash: shortConfigHash(configHash),
      }),
      draft: { ...bindingDraft },
      baseHash: configHash,
    });
    setError("");
  };

  const executeAddBinding = async (draft: RoutingBindingDraft, baseHash: string) => {
    setActionState("adding");
    try {
      const result = await addRoutingBindingMutation.mutateAsync({
        agentId: draft.agentId.trim(),
        match: buildRoutingMatch(draft),
        baseHash,
        comment: draft.comment.trim() || undefined,
        position: parsePosition(draft.position),
      });
      setMutationResult(result);
      setValidationResult(null);
      setBindingDraft(DEFAULT_BINDING_DRAFT);
      setShowBindingDraft(false);
      setError("");
      await refresh(result.binding.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("addFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const removeSelectedBinding = () => {
    if (!selectedBinding || !configHash) {
      setError(t("selectBindingBeforeRemove"));
      return;
    }
    setPendingAction({
      kind: "remove",
      label: t("removeBinding"),
      hint: t("confirmRemoveHint", {
        agentId: selectedBinding.agentId,
        bindingId: selectedBinding.id,
      }),
      binding: selectedBinding,
      baseHash: configHash,
    });
    setError("");
  };

  const executeRemoveBinding = async (binding: DeckGoRoutingBinding, baseHash: string) => {
    setActionState("removing");
    try {
      const result = await removeRoutingBindingMutation.mutateAsync({
        id: binding.id,
        baseHash,
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

  const reorderSelectedBinding = (direction: -1 | 1) => {
    if (!selectedBinding || !configHash) {
      setError(t("selectBindingBeforeReorder"));
      return;
    }
    const nextPosition = selectedBindingIndex + direction;
    if (selectedBindingIndex < 0 || nextPosition < 0 || nextPosition >= bindings.length) {
      setError(t("bindingAtEdge"));
      return;
    }
    setPendingAction({
      kind: "move",
      label: direction < 0 ? t("moveUp") : t("moveDown"),
      hint: t("confirmMoveHint", {
        agentId: selectedBinding.agentId,
        direction: direction < 0 ? t("moveUpDirection") : t("moveDownDirection"),
        position: nextPosition + 1,
        hash: shortConfigHash(configHash),
      }),
      binding: selectedBinding,
      direction,
      baseHash: configHash,
    });
    setError("");
  };

  const executeReorderBinding = async (
    binding: DeckGoRoutingBinding,
    direction: -1 | 1,
    baseHash: string,
  ) => {
    const currentIndex = bindings.findIndex((candidate) => candidate.id === binding.id);
    const nextPosition = currentIndex + direction;
    if (currentIndex < 0 || nextPosition < 0 || nextPosition >= bindings.length) {
      setError(t("bindingAtEdge"));
      return;
    }
    setActionState("reordering");
    try {
      const removeResult = await removeRoutingBindingMutation.mutateAsync({
        id: binding.id,
        baseHash,
      });
      const addResult = await addRoutingBindingMutation.mutateAsync({
        agentId: binding.agentId,
        match: binding.match,
        baseHash: removeResult.configHash,
        comment: binding.comment,
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

  const patchDmScope = () => {
    if (!scopeDraft.trim()) {
      setError(t("dmScopeRequired"));
      return;
    }
    if (!configHash) {
      setError(t("configHashRequiredScope"));
      return;
    }
    const nextScope = scopeDraft.trim();
    setPendingAction({
      kind: "scope",
      label: t("patchDmScope"),
      hint: t("confirmScopeHint", {
        from: dmScope || emptyLabel,
        to: nextScope,
        hash: shortConfigHash(configHash),
      }),
      nextScope,
      baseHash: configHash,
    });
    setError("");
  };

  const executePatchDmScope = async (nextScope: string, baseHash: string) => {
    setActionState("scope");
    try {
      const result = await patchRoutingDmScopeMutation.mutateAsync({
        baseHash,
        scope: nextScope,
      });
      setScopeResult(t("dmScopeUpdated", { scope: nextScope }));
      setDmScope(nextScope);
      setConfigHash(result.hash || result.baseHash || baseHash);
      setError("");
      await refresh(selectedBindingId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("dmScopePatchFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }
    const action = pendingAction;
    setPendingAction(null);
    switch (action.kind) {
      case "scope":
        await executePatchDmScope(action.nextScope, action.baseHash);
        break;
      case "add":
        await executeAddBinding(action.draft, action.baseHash);
        break;
      case "remove":
        await executeRemoveBinding(action.binding, action.baseHash);
        break;
      case "move":
        await executeReorderBinding(action.binding, action.direction, action.baseHash);
        break;
    }
  };

  const handleBindingKeyDown = (event: KeyboardEvent<HTMLButtonElement>, bindingId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedBindingId(bindingId);
    }
  };

  return (
    <section className="routing-panel" data-testid="routing-panel">
      <header className="routing-panel__header">
        <div>
          <p className="routing-panel__eyebrow">Deck routing</p>
          <h2>{t("title")}</h2>
          <p>{t("description")}</p>
        </div>
        <div className="routing-panel__header-actions">
          <Badge variant={statusVariant(loadState)}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </Badge>
          <Badge variant={conflictPairs.length > 0 ? "warn" : "neutral"}>
            {t("conflictCount", { count: conflictPairs.length })}
          </Badge>
          <Button size="sm" onClick={() => void refresh()}>
            {t("refreshRouting")}
          </Button>
        </div>
      </header>

      <section className="routing-panel__metrics" aria-label={t("routingMetrics")}>
        <MetricTile label={t("bindingsStat")} value={bindings.length} />
        <MetricTile label={t("defaultAgent")} value={defaultAgentId || emptyLabel} />
        <MetricTile label={t("dmScope")} value={dmScope || emptyLabel} />
        <MetricTile label={t("configHash")} value={configHash || emptyLabel} />
        <MetricTile
          label={t("matchedBy")}
          value={simulationResult?.agentId || simulationResult?.matchedBy || emptyLabel}
        />
      </section>

      <div className="routing-workbench">
        <Card className="routing-queue-card" padded={false}>
          <div className="routing-card-header">
            <div>
              <h3>{t("bindings")}</h3>
              <p>{t("bindingQueueDescription")}</p>
            </div>
            <div className="routing-card-header__actions">
              <Button size="sm" onClick={() => setShowBindingDraft((current) => !current)}>
                {showBindingDraft ? t("closeBindingDraft") : t("showAddBinding")}
              </Button>
              {loadState === "loading" ? <Spinner size="sm" aria-label={tc("loading")} /> : null}
            </div>
          </div>
          <div className="routing-card-body">
            <div className="routing-filter-row">
              <Input
                inputSize="sm"
                value={filters.agentId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, agentId: event.target.value }))
                }
                placeholder="agent id"
                aria-label={t("agentId")}
              />
              <Input
                inputSize="sm"
                value={filters.channel}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, channel: event.target.value }))
                }
                placeholder="channel"
                aria-label={t("dimChannel")}
              />
              <Input
                inputSize="sm"
                value={filters.accountId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, accountId: event.target.value }))
                }
                placeholder="account id"
                aria-label={t("dimAccountId")}
              />
              <Button size="sm" onClick={() => void refresh()}>
                {t("refreshRouting")}
              </Button>
            </div>

            <section className="routing-scope-card">
              <div>
                <p className="routing-panel__eyebrow">{t("dmScopeStrategy")}</p>
                <p className="routing-panel__note">{t("dmScopePatchHint")}</p>
              </div>
              <div className="routing-inline-actions">
                <Select
                  selectSize="sm"
                  value={scopeDraft}
                  onChange={(event) => setScopeDraft(event.target.value)}
                  aria-label={t("dmScopeStrategy")}
                >
                  {scopeDraft && !isKnownDmScope(scopeDraft) ? (
                    <option value={scopeDraft}>{scopeDraft}</option>
                  ) : null}
                  {DM_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={actionState !== "idle" || Boolean(pendingAction)}
                  onClick={() => patchDmScope()}
                >
                  {actionState === "scope" ? t("patchingDmScope") : t("patchDmScope")}
                </Button>
              </div>
              {scopeResult ? <p className="routing-panel__success">{scopeResult}</p> : null}
            </section>

            {error ? (
              <p className="routing-panel__error" role="alert">
                {error}
              </p>
            ) : null}

            {pendingAction ? (
              <section
                className={`routing-confirm ${pendingAction.kind === "remove" ? "is-danger" : ""}`}
                role="alert"
              >
                <div>
                  <p className="routing-panel__eyebrow">{t("confirmActionTitle")}</p>
                  <strong>{pendingAction.label}</strong>
                  <p className="routing-panel__note">{pendingAction.hint}</p>
                </div>
                <div className="routing-inline-actions">
                  <Button
                    size="sm"
                    variant={pendingAction.kind === "remove" ? "danger" : "primary"}
                    disabled={actionState !== "idle"}
                    onClick={() => void confirmPendingAction()}
                  >
                    {t("confirmAction")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={actionState !== "idle"}
                    onClick={() => setPendingAction(null)}
                  >
                    {t("cancelAction")}
                  </Button>
                </div>
              </section>
            ) : null}

            {bindings.length === 0 ? (
              <p className="routing-panel__empty">{t("noBindingsLoaded")}</p>
            ) : (
              <ul className="routing-binding-list">
                {bindings.map((binding) => {
                  const conflicts = conflictMap.get(binding.id) ?? [];
                  const selected = selectedBinding?.id === binding.id;
                  return (
                    <li key={binding.id}>
                      <button
                        type="button"
                        className={`routing-binding-row ${selected ? "is-selected" : ""}`}
                        onClick={() => setSelectedBindingId(binding.id)}
                        onKeyDown={(event) => handleBindingKeyDown(event, binding.id)}
                        aria-pressed={selected}
                      >
                        <span className="routing-binding-row__top">
                          <strong>{binding.agentId}</strong>
                          <Badge variant={conflicts.length > 0 ? "warn" : "neutral"}>
                            {binding.tier}
                          </Badge>
                        </span>
                        <span className="routing-binding-row__meta">
                          {t("bindingId")}: {binding.id}
                        </span>
                        <MatchChipRow binding={binding} labels={bindingMatchLabels} />
                        {conflicts.length > 0 ? (
                          <span className="routing-binding-row__warning">
                            {t("conflictsValue", { count: conflicts.length })}:{" "}
                            {conflicts
                              .map((conflict) => describeConflict(t, binding.id, conflict))
                              .join("; ")}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div className="routing-detail">
          <Card className="routing-detail-card" padded={false}>
            <div className="routing-card-header">
              <div>
                <h3>{t("routingDetail")}</h3>
                <p>{t("routingDetailDescription")}</p>
              </div>
              <Badge>
                {t("configHash")}: {configHash || emptyLabel}
              </Badge>
            </div>
            <div className="routing-card-body">
              {selectedBinding ? (
                <section className="routing-selected">
                  <div>
                    <p className="routing-panel__eyebrow">{t("selectedBinding")}</p>
                    <h3>{selectedBinding.agentId}</h3>
                    <p className="routing-panel__note">
                      {selectedBinding.id} - {t("tier")} {selectedBinding.tier} -{" "}
                      {t("bindingOrder", {
                        current: selectedBindingIndex + 1,
                        total: bindings.length,
                      })}
                    </p>
                    <p className="routing-panel__note">
                      {summarizeBindingMatch(selectedBinding, bindingMatchLabels)}
                    </p>
                  </div>
                  <div className="routing-selected__badges">
                    <Badge>{selectedBinding.match.channel}</Badge>
                    <Badge
                      variant={
                        (conflictMap.get(selectedBinding.id) ?? []).length > 0 ? "warn" : "ok"
                      }
                    >
                      {t("conflictsValue", {
                        count: (conflictMap.get(selectedBinding.id) ?? []).length,
                      })}
                    </Badge>
                  </div>
                </section>
              ) : (
                <p className="routing-panel__empty">{t("chooseBinding")}</p>
              )}

              {selectedBinding ? (
                <>
                  <div className="routing-inline-actions">
                    <Button
                      size="sm"
                      disabled={actionState !== "idle"}
                      onClick={loadSelectedBindingIntoSimulation}
                    >
                      {t("useAsSimulation")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!selectedBinding.agentId.trim()}
                      onClick={() => navigateToAgent(ui, selectedBinding.agentId)}
                    >
                      {t("openBindingAgent")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!selectedBindingChannelId}
                      onClick={() => navigateToChannel(ui, selectedBindingChannelId)}
                    >
                      {t("openBindingChannel")}
                    </Button>
                    {selectedBindingChannelId === "wecom" && selectedBindingAccountId ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigateToChannelAccess(
                            ui,
                            selectedBindingChannelId,
                            selectedBindingAccountId,
                          )
                        }
                      >
                        {t("openBindingAccess")}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={
                        actionState !== "idle" ||
                        Boolean(pendingAction) ||
                        selectedBindingIndex <= 0
                      }
                      onClick={() => reorderSelectedBinding(-1)}
                    >
                      {actionState === "reordering" ? t("reordering") : t("moveUp")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        actionState !== "idle" ||
                        Boolean(pendingAction) ||
                        selectedBindingIndex < 0 ||
                        selectedBindingIndex >= bindings.length - 1
                      }
                      onClick={() => reorderSelectedBinding(1)}
                    >
                      {actionState === "reordering" ? t("reordering") : t("moveDown")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={actionState !== "idle" || Boolean(pendingAction)}
                      onClick={() => removeSelectedBinding()}
                    >
                      {actionState === "removing" ? t("removingBinding") : t("removeBinding")}
                    </Button>
                  </div>
                  <JsonDetails title={t("bindingPayload")} payload={selectedBinding} />
                </>
              ) : null}
            </div>
          </Card>

          <Card className="routing-simulator" padded={false}>
            <div className="routing-card-header">
              <div>
                <h3>{t("simulateRouteSelection")}</h3>
                <p>{t("simulatorDescription")}</p>
              </div>
              {simulationResult ? (
                <Badge variant="ok">
                  {t("matchedByValue", { tier: simulationResult.matchedBy })}
                </Badge>
              ) : null}
            </div>
            <div className="routing-card-body">
              <div className="routing-form-grid">
                <Input
                  inputSize="sm"
                  value={simulationDraft.channel}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, channel: event.target.value }))
                  }
                  aria-label={t("simulationChannel")}
                  placeholder={t("channelPlaceholder")}
                />
                <Input
                  inputSize="sm"
                  value={simulationDraft.accountId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, accountId: event.target.value }))
                  }
                  aria-label={t("simulationAccountId")}
                  placeholder={t("accountIdPlaceholder")}
                />
                <Select
                  selectSize="sm"
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
                </Select>
                <Input
                  inputSize="sm"
                  value={simulationDraft.peerId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, peerId: event.target.value }))
                  }
                  aria-label={t("simulationPeerId")}
                  placeholder={t("peerIdPlaceholder")}
                />
                <Input
                  inputSize="sm"
                  value={simulationDraft.guildId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, guildId: event.target.value }))
                  }
                  aria-label={t("simulationGuildId")}
                  placeholder={t("guildIdPlaceholder")}
                />
                <Input
                  inputSize="sm"
                  value={simulationDraft.teamId}
                  onChange={(event) =>
                    setSimulationDraft((current) => ({ ...current, teamId: event.target.value }))
                  }
                  aria-label={t("simulationTeamId")}
                  placeholder={t("teamIdPlaceholder")}
                />
                <Input
                  inputSize="sm"
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
              <div className="routing-inline-actions">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void runSimulation()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "simulating" ? t("simulating") : t("simulate")}
                </Button>
                <Button size="sm" onClick={resetSimulation}>
                  {t("resetSimulation")}
                </Button>
              </div>

              {simulationResult ? (
                <section className="routing-result">
                  <div className="routing-selected">
                    <div>
                      <p className="routing-panel__eyebrow">{t("simulationResult")}</p>
                      <h3>{simulationResult.agentId || t("noAgentMatched")}</h3>
                      <p className="routing-panel__note">
                        {t("sessionValue", { session: simulationResult.sessionKey || emptyLabel })}
                      </p>
                    </div>
                    <Badge>{t("tiersCount", { count: tiers.length })}</Badge>
                  </div>
                  <div className="routing-inline-actions">
                    <Button
                      size="sm"
                      disabled={!simulationResult.agentId?.trim()}
                      onClick={() => navigateToAgent(ui, simulationResult.agentId ?? "")}
                    >
                      {t("openSimulationAgent")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!simulationResult.sessionKey?.trim()}
                      onClick={() => navigateToSession(ui, simulationResult.sessionKey ?? "")}
                    >
                      {t("openSimulationSession")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!simulationChannelId}
                      onClick={() => navigateToChannel(ui, simulationChannelId)}
                    >
                      {t("openSimulationChannel")}
                    </Button>
                    {simulationChannelId === "wecom" && simulationAccountId ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigateToChannelAccess(ui, simulationChannelId, simulationAccountId)
                        }
                      >
                        {t("openSimulationAccess")}
                      </Button>
                    ) : null}
                  </div>
                  <ul className="routing-tier-list">
                    {tiers.map((tier) => (
                      <li key={tier.tier}>
                        <div className="routing-tier-row">
                          <strong>{tier.tier}</strong>
                          <Badge variant={simulationTierVariant(tier)}>
                            {summarizeSimulationTier(t, tier)}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <JsonDetails title={t("simulationPayload")} payload={simulationResult} />
                </section>
              ) : (
                <p className="routing-panel__empty">{t("runSimulationPrompt")}</p>
              )}
            </div>
          </Card>

          {showBindingDraft ? (
            <Card className="routing-draft" padded={false}>
              <div className="routing-card-header">
                <div>
                  <h3>{t("addOrValidateBinding")}</h3>
                  <p>{t("bindingDraftDescription")}</p>
                </div>
                <div className="routing-card-header__actions">
                  {validationResult ? (
                    <Badge variant={validationResult.ok ? "ok" : "warn"}>
                      {t("validationResult", {
                        state: validationResult.ok ? t("ok") : t("blocked"),
                      })}
                    </Badge>
                  ) : null}
                  <Button size="sm" onClick={() => setShowBindingDraft(false)}>
                    {t("closeBindingDraft")}
                  </Button>
                </div>
              </div>
              <div className="routing-card-body">
                <div className="routing-form-grid">
                  <Input
                    inputSize="sm"
                    value={bindingDraft.agentId}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, agentId: event.target.value }))
                    }
                    aria-label={t("bindingAgentId")}
                    placeholder={t("bindingAgentIdPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.channel}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, channel: event.target.value }))
                    }
                    aria-label={t("bindingChannel")}
                    placeholder={t("bindingChannelPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.accountId}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, accountId: event.target.value }))
                    }
                    aria-label={t("bindingAccountId")}
                    placeholder={t("bindingAccountIdPlaceholder")}
                  />
                  <Select
                    selectSize="sm"
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
                  </Select>
                  <Input
                    inputSize="sm"
                    value={bindingDraft.peerId}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, peerId: event.target.value }))
                    }
                    aria-label={t("bindingPeerId")}
                    placeholder={t("bindingPeerIdPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.guildId}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, guildId: event.target.value }))
                    }
                    aria-label={t("bindingGuildId")}
                    placeholder={t("bindingGuildIdPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.teamId}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, teamId: event.target.value }))
                    }
                    aria-label={t("bindingTeamId")}
                    placeholder={t("bindingTeamIdPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.roles}
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, roles: event.target.value }))
                    }
                    aria-label={t("bindingRoles")}
                    placeholder={t("bindingRolesPlaceholder")}
                  />
                  <Input
                    inputSize="sm"
                    value={bindingDraft.position}
                    inputMode="numeric"
                    onChange={(event) =>
                      setBindingDraft((current) => ({ ...current, position: event.target.value }))
                    }
                    aria-label={t("bindingPosition")}
                    placeholder={t("bindingPositionPlaceholder")}
                  />
                </div>
                <Textarea
                  value={bindingDraft.comment}
                  onChange={(event) =>
                    setBindingDraft((current) => ({ ...current, comment: event.target.value }))
                  }
                  aria-label={t("bindingComment")}
                  placeholder={t("bindingCommentPlaceholder")}
                  noResize
                />
                <div className="routing-inline-actions">
                  <Button
                    size="sm"
                    disabled={actionState !== "idle" || Boolean(pendingAction)}
                    onClick={() => void validateBinding()}
                  >
                    {actionState === "validating" ? t("validating") : t("validateBinding")}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={actionState !== "idle" || Boolean(pendingAction)}
                    onClick={() => addBinding()}
                  >
                    {actionState === "adding" ? t("addingBinding") : t("addBindingAction")}
                  </Button>
                </div>
                {validationResult ? (
                  <div className="routing-validation-row">
                    <Badge variant={validationResult.ok ? "ok" : "warn"}>
                      {t("validationResult", {
                        state: validationResult.ok ? t("ok") : t("blocked"),
                      })}
                    </Badge>
                    <Badge>{t("tierValue", { tier: validationResult.tier })}</Badge>
                    <Badge>
                      {t("conflictsValue", { count: validationResult.conflicts.length })}
                    </Badge>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card className="routing-activity" padded={false}>
            <div className="routing-card-header">
              <div>
                <h3>{t("activityFeed")}</h3>
                <p>{t("activityFeedDescription")}</p>
              </div>
              <Button size="sm" onClick={() => void loadRoutingActivity()}>
                {t("refreshActivity")}
              </Button>
            </div>
            <div className="routing-card-body">
              {routingActivityNotConfigured ? (
                <GatewayNotConfiguredEmptyState className="routing-panel__not-configured" />
              ) : routingActivityEvents.length > 0 ? (
                <ul className="routing-activity-list">
                  {routingActivityEvents.map((event) => (
                    <li key={event.id}>
                      <article className="routing-activity-row">
                        <strong>{event.description}</strong>
                        <p className="routing-panel__note">
                          {event.type} - {event.agentName || event.agentId || t("systemActor")}
                        </p>
                        <p className="routing-panel__note">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </article>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="routing-panel__empty">{t("noRecentActivity")}</p>
              )}
              {routingActivityError && !routingActivityNotConfigured ? (
                <p className="routing-panel__error">{routingActivityError}</p>
              ) : null}
            </div>
          </Card>

          {mutationResult ? (
            <Card className="routing-mutation" padded={false}>
              <div className="routing-card-header">
                <div>
                  <h3>{t("routingMutation")}</h3>
                  <p>{t("mutationDescription")}</p>
                </div>
                {"configHash" in mutationResult ? (
                  <Badge>
                    {t("configHash")}: {mutationResult.configHash}
                  </Badge>
                ) : null}
              </div>
              <div className="routing-card-body">
                <JsonDetails title={t("routingMutation")} payload={mutationResult} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
}
