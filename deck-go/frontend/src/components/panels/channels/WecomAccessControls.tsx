import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDeckConfig,
  patchDeckConfig,
  type DeckGoConfigApplyResponse,
  type DeckGoConfigSnapshotResponse,
} from "../../../api";
import { WecomRoutingSummary } from "./WecomRoutingSummary";

type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

export type WecomAccessAccount = {
  accountId: string;
  label?: string;
};

type WecomDmState = {
  policy: DmPolicy;
  allowFrom: string[];
};

type WecomAccountAccessState = {
  botConfigured: boolean;
  agentConfigured: boolean;
  bot: WecomDmState;
  agent: WecomDmState;
};

type WecomAccessModel = {
  defaultAccountId: string;
  isMatrix: boolean;
  accountIds: string[];
  dynamicAgents: {
    enabled: boolean;
    dmCreateAgent: boolean;
    groupEnabled: boolean;
    adminUsers: string[];
  };
  failClosedOnDefaultRoute: boolean;
  accounts: Record<string, WecomAccountAccessState>;
};

const DM_POLICIES: DmPolicy[] = ["pairing", "allowlist", "open", "disabled"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toPolicy(value: unknown): DmPolicy {
  return DM_POLICIES.includes(value as DmPolicy) ? (value as DmPolicy) : "pairing";
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function dedupePreserveOrder(entries: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const entry of entries) {
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    next.push(entry);
  }
  return next;
}

export function normalizeWecomAllowFromEntry(raw: string): string {
  return raw
    .trim()
    .replace(/^(wecom:|user:|userid:)+/i, "")
    .trim()
    .toLowerCase();
}

function readConfigObject(snapshot: DeckGoConfigSnapshotResponse): Record<string, unknown> {
  if (isRecord(snapshot.config)) {
    return snapshot.config;
  }
  if (typeof snapshot.raw === "string" && snapshot.raw.trim()) {
    const parsed = JSON.parse(snapshot.raw) as unknown;
    return toRecord(parsed);
  }
  return {};
}

function readChannelConfig(snapshot: DeckGoConfigSnapshotResponse | null, channelId: string) {
  if (!snapshot) {
    return {};
  }
  const config = readConfigObject(snapshot);
  const channels = toRecord(config.channels);
  return toRecord(channels[channelId]);
}

function buildWecomAccessModel(params: {
  accounts: WecomAccessAccount[];
  channelConfig: Record<string, unknown>;
  defaultAccountId?: string;
}): WecomAccessModel {
  const root = params.channelConfig;
  const rawAccounts = toRecord(root.accounts);
  const accountIdsFromChannel = params.accounts.map((account) => account.accountId);
  const accountIdsFromConfig = Object.keys(rawAccounts);
  const rawDefault =
    params.defaultAccountId ||
    (typeof root.defaultAccount === "string" ? root.defaultAccount : "") ||
    accountIdsFromChannel[0] ||
    accountIdsFromConfig[0] ||
    "default";
  const defaultAccountId = rawDefault || "default";
  const accountIds = dedupePreserveOrder([
    defaultAccountId,
    ...accountIdsFromChannel,
    ...accountIdsFromConfig,
  ]);
  const isMatrix = accountIds.length > 1 || accountIdsFromConfig.length > 0;
  const accounts = Object.fromEntries(
    accountIds.map((accountId) => {
      const scoped = isMatrix ? { ...root, ...toRecord(rawAccounts[accountId]) } : root;
      const bot = toRecord(scoped.bot);
      const agent = toRecord(scoped.agent);
      const botDm = toRecord(bot.dm);
      const agentDm = toRecord(agent.dm);
      return [
        accountId,
        {
          botConfigured: Object.keys(bot).length > 0,
          agentConfigured: Object.keys(agent).length > 0,
          bot: {
            policy: toPolicy(botDm.policy),
            allowFrom: normalizeList(botDm.allowFrom),
          },
          agent: {
            policy: toPolicy(agentDm.policy),
            allowFrom: normalizeList(agentDm.allowFrom),
          },
        },
      ] as const;
    }),
  );
  const dynamicAgents = toRecord(root.dynamicAgents);
  const routing = toRecord(root.routing);
  return {
    defaultAccountId,
    isMatrix,
    accountIds,
    dynamicAgents: {
      enabled: dynamicAgents.enabled === true,
      dmCreateAgent: dynamicAgents.dmCreateAgent !== false,
      groupEnabled: dynamicAgents.groupEnabled !== false,
      adminUsers: normalizeList(dynamicAgents.adminUsers),
    },
    failClosedOnDefaultRoute: routing.failClosedOnDefaultRoute === true,
    accounts,
  };
}

function AllowFromEditor(props: {
  entries: string[];
  placeholder: string;
  hint: string;
  onChange: (entries: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");

  const commit = (rawValues: string[]) => {
    props.onChange(
      dedupePreserveOrder(
        rawValues
          .map((entry) => normalizeWecomAllowFromEntry(entry))
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
  };

  const addInput = () => {
    if (!input.trim()) {
      return;
    }
    commit([...props.entries, input]);
    setInput("");
  };

  const applyBulk = () => {
    const parsed = bulkInput
      .split(/\r?\n/g)
      .flatMap((line) => line.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setBulkInput("");
      return;
    }
    commit([...props.entries, ...parsed]);
    setBulkInput("");
  };

  return (
    <div className="deckgo-form-grid deck-ui-channels-form-grid">
      <div className="deckgo-meta">
        {props.entries.length} entries | {props.hint}
      </div>
      <div className="deckgo-actions deck-ui-channels-actions">
        <input
          className="deckgo-input deck-ui-channels-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addInput();
            }
          }}
          placeholder={props.placeholder}
        />
        <button className="deckgo-button deck-ui-channels-button" type="button" onClick={addInput}>
          Add
        </button>
      </div>
      {props.entries.length > 0 ? (
        <div className="deckgo-pill-row deck-ui-channels-status-row">
          {props.entries.map((entry) => (
            <button
              key={entry}
              className={`deckgo-pill ${entry === "*" ? "is-positive" : ""}`}
              type="button"
              onClick={() =>
                props.onChange(props.entries.filter((candidate) => candidate !== entry))
              }
              aria-label={`Remove ${entry}`}
            >
              {entry} x
            </button>
          ))}
        </div>
      ) : (
        <p className="deckgo-note">No entries configured.</p>
      )}
      <details className="deckgo-selectable-card deck-ui-channels-row">
        <summary>Bulk import</summary>
        <div className="deckgo-form-grid deck-ui-channels-form-grid">
          <textarea
            className="deckgo-input deck-ui-channels-input deck-ui-channels-textarea"
            rows={4}
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder="Paste one entry per line or comma-separated values"
          />
          <button
            className="deckgo-button deck-ui-channels-button"
            type="button"
            onClick={applyBulk}
          >
            Apply bulk
          </button>
        </div>
      </details>
    </div>
  );
}

function PolicySection(props: {
  title: string;
  description: string;
  dm: WecomDmState;
  dirty: boolean;
  saving: boolean;
  onChange: (dm: WecomDmState) => void;
  onSave: () => void;
}) {
  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface">
      <p className="deckgo-surface-label">{props.title}</p>
      <p className="deckgo-note">{props.description}</p>
      {props.dm.policy === "allowlist" && props.dm.allowFrom.length === 0 ? (
        <p className="deckgo-note">Allowlist mode is enabled but allowFrom is empty.</p>
      ) : null}
      <div className="deckgo-form-grid deck-ui-channels-form-grid">
        <label className="deckgo-form-row">
          <span>Policy</span>
          <select
            className="deckgo-input deck-ui-channels-input"
            value={props.dm.policy}
            onChange={(event) =>
              props.onChange({ ...props.dm, policy: event.target.value as DmPolicy })
            }
            aria-label={`${props.title} policy`}
          >
            {DM_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {policy}
              </option>
            ))}
          </select>
        </label>
        {props.dm.policy === "allowlist" ? (
          <AllowFromEditor
            entries={props.dm.allowFrom}
            onChange={(allowFrom) => props.onChange({ ...props.dm, allowFrom })}
            hint="userid / user:userid / wecom:userid / *"
            placeholder="Add a WeCom user id or *"
          />
        ) : null}
        <button
          className="deckgo-button is-primary deck-ui-channels-button"
          type="button"
          disabled={!props.dirty || props.saving}
          onClick={props.onSave}
        >
          {props.saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function WecomAccessControls(props: {
  channelId: string;
  accounts: WecomAccessAccount[];
  defaultAccountId?: string;
  initialAccountId?: string;
  initialFocus?: "access";
  onSaved?: () => Promise<void> | void;
}) {
  const [snapshot, setSnapshot] = useState<DeckGoConfigSnapshotResponse | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready">("idle");
  const [error, setError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [botDm, setBotDm] = useState<WecomDmState>({ policy: "pairing", allowFrom: [] });
  const [agentDm, setAgentDm] = useState<WecomDmState>({ policy: "pairing", allowFrom: [] });
  const [dynamicAgents, setDynamicAgents] = useState({
    enabled: false,
    dmCreateAgent: true,
    groupEnabled: true,
    adminUsers: [] as string[],
  });
  const [failClosed, setFailClosed] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [saveResult, setSaveResult] = useState<DeckGoConfigApplyResponse | null>(null);

  const channelConfig = useMemo(
    () => readChannelConfig(snapshot, props.channelId),
    [props.channelId, snapshot],
  );
  const model = useMemo(
    () =>
      buildWecomAccessModel({
        accounts: props.accounts,
        channelConfig,
        defaultAccountId: props.defaultAccountId,
      }),
    [channelConfig, props.accounts, props.defaultAccountId],
  );
  const baseHash = snapshot?.baseHash ?? snapshot?.hash ?? undefined;

  const reloadConfig = useCallback(async () => {
    setLoadState("loading");
    try {
      const next = await fetchDeckConfig();
      setSnapshot(next);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setSnapshot(null);
      setError(loadError instanceof Error ? loadError.message : "config fetch failed");
    }
  }, []);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  useEffect(() => {
    if (!model.accountIds.includes(selectedAccountId)) {
      const initialAccountId = props.initialAccountId?.trim() ?? "";
      setSelectedAccountId(
        initialAccountId && model.accountIds.includes(initialAccountId)
          ? initialAccountId
          : model.defaultAccountId,
      );
    }
  }, [model.accountIds, model.defaultAccountId, props.initialAccountId, selectedAccountId]);

  useEffect(() => {
    const selected = model.accounts[selectedAccountId] ?? model.accounts[model.defaultAccountId];
    setBotDm(selected?.bot ?? { policy: "pairing", allowFrom: [] });
    setAgentDm(selected?.agent ?? { policy: "pairing", allowFrom: [] });
    setDynamicAgents(model.dynamicAgents);
    setFailClosed(model.failClosedOnDefaultRoute);
  }, [
    model.accounts,
    model.defaultAccountId,
    model.dynamicAgents,
    model.failClosedOnDefaultRoute,
    selectedAccountId,
  ]);

  const selectedState = model.accounts[selectedAccountId] ?? model.accounts[model.defaultAccountId];
  const selectedLabel =
    props.accounts.find((account) => account.accountId === selectedAccountId)?.label ??
    selectedAccountId;
  const botDirty = JSON.stringify(botDm) !== JSON.stringify(selectedState?.bot);
  const agentDirty = JSON.stringify(agentDm) !== JSON.stringify(selectedState?.agent);
  const dynamicDirty = JSON.stringify(dynamicAgents) !== JSON.stringify(model.dynamicAgents);
  const routingDirty = failClosed !== model.failClosedOnDefaultRoute;

  const saveChannelPatch = useCallback(
    async (section: string, patch: Record<string, unknown>) => {
      setSavingSection(section);
      try {
        const result = await patchDeckConfig({ channels: { [props.channelId]: patch } }, baseHash);
        setSaveResult(result);
        await reloadConfig();
        await props.onSaved?.();
        setError("");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "config patch failed");
      } finally {
        setSavingSection("");
      }
    },
    [baseHash, props, reloadConfig],
  );

  const saveDmScope = (scope: "bot" | "agent", dm: WecomDmState) => {
    const modePatch = { [scope]: { dm: { policy: dm.policy, allowFrom: dm.allowFrom } } };
    const patch = model.isMatrix ? { accounts: { [selectedAccountId]: modePatch } } : modePatch;
    void saveChannelPatch(scope, patch);
  };

  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface deck-ui-channels-wecom">
      <p className="deckgo-surface-label">WeCom access controls</p>
      {props.initialFocus === "access" ? (
        <p className="deckgo-note">Opened from a channel access handoff.</p>
      ) : null}
      <p className="deckgo-note">
        Edit DM allowlists, dynamic-agent isolation, and unmatched-route behavior through the
        current config patch route.
      </p>
      <div className="deckgo-pill-row deck-ui-channels-status-row">
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          config {loadState}
        </span>
        <span className="deckgo-pill">hash {baseHash ?? "n/a"}</span>
      </div>
      {error ? <p className="deckgo-note">{error}</p> : null}
      {model.accountIds.length > 1 ? (
        <label className="deckgo-form-row deck-ui-channels-form-row">
          <span>Account</span>
          <select
            className="deckgo-input deck-ui-channels-input"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            aria-label="WeCom access account"
          >
            {model.accountIds.map((accountId) => (
              <option key={accountId} value={accountId}>
                {props.accounts.find((account) => account.accountId === accountId)?.label ??
                  accountId}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {model.accountIds.length > 1 ? (
        <div className="deckgo-surface-grid deck-ui-channels-grid">
          {model.accountIds.map((accountId) => {
            const account = model.accounts[accountId];
            const label =
              props.accounts.find((candidate) => candidate.accountId === accountId)?.label ??
              accountId;
            return (
              <button
                key={accountId}
                className={`deckgo-selectable-card deck-ui-channels-row ${
                  selectedAccountId === accountId ? "is-selected" : ""
                }`}
                type="button"
                onClick={() => setSelectedAccountId(accountId)}
              >
                <strong>{label}</strong>
                <div className="deckgo-meta">
                  bot {account?.botConfigured ? account.bot.policy : "not configured"} | agent{" "}
                  {account?.agentConfigured ? account.agent.policy : "not configured"}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
      {selectedState?.botConfigured ? (
        <PolicySection
          title={`Bot DM policy (${selectedLabel})`}
          description="Controls how users can direct-message the WeCom bot for this account."
          dm={botDm}
          dirty={botDirty}
          saving={savingSection === "bot"}
          onChange={setBotDm}
          onSave={() => saveDmScope("bot", botDm)}
        />
      ) : null}
      {selectedState?.agentConfigured ? (
        <PolicySection
          title={`Agent DM policy (${selectedLabel})`}
          description="Controls how users can direct-message the WeCom agent for this account."
          dm={agentDm}
          dirty={agentDirty}
          saving={savingSection === "agent"}
          onChange={setAgentDm}
          onSave={() => saveDmScope("agent", agentDm)}
        />
      ) : null}
      {!selectedState?.botConfigured && !selectedState?.agentConfigured ? (
        <p className="deckgo-note">No bot or agent access modes are configured for this account.</p>
      ) : null}
      <div className="deckgo-surface-tile deck-ui-channels-surface">
        <p className="deckgo-surface-label">Dynamic agents</p>
        <p className="deckgo-note">
          Configure WeCom-specific per-user and per-group agent isolation behavior.
        </p>
        {dynamicAgents.enabled && dynamicAgents.adminUsers.length === 0 ? (
          <p className="deckgo-note">Dynamic agents are enabled without admin users.</p>
        ) : null}
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>Enable dynamic agents</span>
          <input
            type="checkbox"
            checked={dynamicAgents.enabled}
            onChange={(event) =>
              setDynamicAgents((current) => ({ ...current, enabled: event.target.checked }))
            }
          />
        </label>
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>Create per-user DM agents</span>
          <input
            type="checkbox"
            checked={dynamicAgents.dmCreateAgent}
            onChange={(event) =>
              setDynamicAgents((current) => ({
                ...current,
                dmCreateAgent: event.target.checked,
              }))
            }
          />
        </label>
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>Create per-group agents</span>
          <input
            type="checkbox"
            checked={dynamicAgents.groupEnabled}
            onChange={(event) =>
              setDynamicAgents((current) => ({ ...current, groupEnabled: event.target.checked }))
            }
          />
        </label>
        <AllowFromEditor
          entries={dynamicAgents.adminUsers}
          onChange={(adminUsers) => setDynamicAgents((current) => ({ ...current, adminUsers }))}
          hint="admins stay on the main agent"
          placeholder="Add an admin user id"
        />
        <button
          className="deckgo-button is-primary deck-ui-channels-button"
          type="button"
          disabled={!dynamicDirty || savingSection === "dynamicAgents"}
          onClick={() =>
            void saveChannelPatch("dynamicAgents", {
              dynamicAgents: {
                enabled: dynamicAgents.enabled,
                dmCreateAgent: dynamicAgents.dmCreateAgent,
                groupEnabled: dynamicAgents.groupEnabled,
                adminUsers: dynamicAgents.adminUsers,
              },
            })
          }
        >
          {savingSection === "dynamicAgents" ? "Saving" : "Save dynamic agents"}
        </button>
      </div>
      <WecomRoutingSummary channelId={props.channelId} accountId={selectedAccountId} />
      <div className="deckgo-surface-tile deck-ui-channels-surface">
        <p className="deckgo-surface-label">Routing behavior</p>
        <p className="deckgo-note">
          Control how WeCom behaves when no explicit route binding matches.
        </p>
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>Reject unmatched messages</span>
          <input
            type="checkbox"
            checked={failClosed}
            onChange={(event) => setFailClosed(event.target.checked)}
          />
        </label>
        <button
          className="deckgo-button is-primary deck-ui-channels-button"
          type="button"
          disabled={!routingDirty || savingSection === "routing"}
          onClick={() =>
            void saveChannelPatch("routing", {
              routing: { failClosedOnDefaultRoute: failClosed },
            })
          }
        >
          {savingSection === "routing" ? "Saving" : "Save routing behavior"}
        </button>
      </div>
      {saveResult ? (
        <p className="deckgo-note">
          Saved config hash {saveResult.hash ?? saveResult.baseHash ?? "n/a"}
        </p>
      ) : null}
    </div>
  );
}
