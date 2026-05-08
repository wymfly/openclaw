import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoConfigApplyResponse, DeckGoConfigSnapshotResponse } from "../../../api";
import { useConfigSnapshotQuery, usePatchDeckConfigMutation } from "../../../data/modules/config";
import { useTranslations } from "../../../i18n/provider";
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
  const t = useTranslations("channels");
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
        {t("entriesWithHint", { count: props.entries.length, hint: props.hint })}
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
          {t("add")}
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
              aria-label={t("removeEntry", { entry })}
            >
              {t("entryWithRemove", { entry })}
            </button>
          ))}
        </div>
      ) : (
        <p className="deckgo-note">{t("noEntriesConfigured")}</p>
      )}
      <details className="deckgo-selectable-card deck-ui-channels-row">
        <summary>{t("bulkImport")}</summary>
        <div className="deckgo-form-grid deck-ui-channels-form-grid">
          <textarea
            className="deckgo-input deck-ui-channels-input deck-ui-channels-textarea"
            rows={4}
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={t("bulkImportPlaceholder")}
          />
          <button
            className="deckgo-button deck-ui-channels-button"
            type="button"
            onClick={applyBulk}
          >
            {t("applyBulk")}
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
  const t = useTranslations("channels");
  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface">
      <p className="deckgo-surface-label">{props.title}</p>
      <p className="deckgo-note">{props.description}</p>
      {props.dm.policy === "allowlist" && props.dm.allowFrom.length === 0 ? (
        <p className="deckgo-note">{t("allowlistEmpty")}</p>
      ) : null}
      <div className="deckgo-form-grid deck-ui-channels-form-grid">
        <label className="deckgo-form-row">
          <span>{t("policy")}</span>
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
            hint={t("access.allowFromHint")}
            placeholder={t("access.allowFromPlaceholder")}
          />
        ) : null}
        <button
          className="deckgo-button is-primary deck-ui-channels-button"
          type="button"
          disabled={!props.dirty || props.saving}
          onClick={props.onSave}
        >
          {props.saving ? t("saving") : t("save")}
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
  const t = useTranslations("channels");
  const configQuery = useConfigSnapshotQuery();
  const patchDeckConfigMutation = usePatchDeckConfigMutation();
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
      const result = await configQuery.refetch();
      if (!result.data) {
        throw result.error ?? new Error(t("configFetchFailed"));
      }
      setSnapshot(result.data);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setSnapshot(null);
      setError(loadError instanceof Error ? loadError.message : t("configFetchFailed"));
    }
  }, [configQuery, t]);

  useEffect(() => {
    if (configQuery.data) {
      setSnapshot(configQuery.data);
      setLoadState("ready");
      setError("");
    }
    if (configQuery.error) {
      setLoadState("idle");
      setSnapshot(null);
      setError(
        configQuery.error instanceof Error ? configQuery.error.message : t("configFetchFailed"),
      );
    }
  }, [configQuery.data, configQuery.error, t]);

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
        const result = await patchDeckConfigMutation.mutateAsync({
          baseHash,
          patch: { channels: { [props.channelId]: patch } },
        });
        setSaveResult(result);
        await reloadConfig();
        await props.onSaved?.();
        setError("");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t("configPatchFailedGeneric"));
      } finally {
        setSavingSection("");
      }
    },
    [baseHash, patchDeckConfigMutation, props.channelId, props.onSaved, reloadConfig, t],
  );

  const saveDmScope = (scope: "bot" | "agent", dm: WecomDmState) => {
    const modePatch = { [scope]: { dm: { policy: dm.policy, allowFrom: dm.allowFrom } } };
    const patch = model.isMatrix ? { accounts: { [selectedAccountId]: modePatch } } : modePatch;
    void saveChannelPatch(scope, patch);
  };

  return (
    <div className="deckgo-surface-tile deck-ui-channels-surface deck-ui-channels-wecom">
      <p className="deckgo-surface-label">{t("wecomAccessControls")}</p>
      {props.initialFocus === "access" ? (
        <p className="deckgo-note">{t("openedFromAccessHandoff")}</p>
      ) : null}
      <p className="deckgo-note">{t("wecomAccessDescription")}</p>
      <div className="deckgo-pill-row deck-ui-channels-status-row">
        <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
          {t("configStatus", { status: t(loadState) })}
        </span>
        <span className="deckgo-pill">
          {t("hashStatus", { hash: baseHash ?? t("notAvailable") })}
        </span>
      </div>
      {error ? <p className="deckgo-note">{error}</p> : null}
      {model.accountIds.length > 1 ? (
        <label className="deckgo-form-row deck-ui-channels-form-row">
          <span>{t("account")}</span>
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
                  {t("accountPolicySummary", {
                    bot: account?.botConfigured ? account.bot.policy : t("notConfigured"),
                    agent: account?.agentConfigured ? account.agent.policy : t("notConfigured"),
                  })}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
      {selectedState?.botConfigured ? (
        <PolicySection
          title={t("botDmPolicyTitle", { label: selectedLabel })}
          description={t("botDmPolicyDescription")}
          dm={botDm}
          dirty={botDirty}
          saving={savingSection === "bot"}
          onChange={setBotDm}
          onSave={() => saveDmScope("bot", botDm)}
        />
      ) : null}
      {selectedState?.agentConfigured ? (
        <PolicySection
          title={t("agentDmPolicyTitle", { label: selectedLabel })}
          description={t("agentDmPolicyDescription")}
          dm={agentDm}
          dirty={agentDirty}
          saving={savingSection === "agent"}
          onChange={setAgentDm}
          onSave={() => saveDmScope("agent", agentDm)}
        />
      ) : null}
      {!selectedState?.botConfigured && !selectedState?.agentConfigured ? (
        <p className="deckgo-note">{t("noAccessModes")}</p>
      ) : null}
      <div className="deckgo-surface-tile deck-ui-channels-surface">
        <p className="deckgo-surface-label">{t("dynamicAgents")}</p>
        <p className="deckgo-note">{t("dynamicAgentsDescription")}</p>
        {dynamicAgents.enabled && dynamicAgents.adminUsers.length === 0 ? (
          <p className="deckgo-note">{t("dynamicAgentsNoAdmins")}</p>
        ) : null}
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>{t("enableDynamicAgents")}</span>
          <input
            type="checkbox"
            checked={dynamicAgents.enabled}
            onChange={(event) =>
              setDynamicAgents((current) => ({ ...current, enabled: event.target.checked }))
            }
          />
        </label>
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>{t("createDmAgents")}</span>
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
          <span>{t("createGroupAgents")}</span>
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
          hint={t("adminsHint")}
          placeholder={t("adminPlaceholder")}
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
          {savingSection === "dynamicAgents" ? t("saving") : t("saveDynamicAgents")}
        </button>
      </div>
      <WecomRoutingSummary channelId={props.channelId} accountId={selectedAccountId} />
      <div className="deckgo-surface-tile deck-ui-channels-surface">
        <p className="deckgo-surface-label">{t("routingBehavior")}</p>
        <p className="deckgo-note">{t("routingBehaviorDescription")}</p>
        <label className="deckgo-checkbox-row deck-ui-channels-check">
          <span>{t("rejectUnmatchedMessages")}</span>
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
          {savingSection === "routing" ? t("saving") : t("saveRoutingBehavior")}
        </button>
      </div>
      {saveResult ? (
        <p className="deckgo-note">
          {t("savedConfigHash", {
            hash: saveResult.hash ?? saveResult.baseHash ?? t("notAvailable"),
          })}
        </p>
      ) : null}
    </div>
  );
}
