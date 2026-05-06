import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { MinusIcon, SearchIcon, ZapIcon } from "@/deck-ui/icons";
import { contextPct, formatTokens, pressureState } from "@/lib/context-utils";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { useNotificationsStore } from "@/stores/notifications";
import { useSessionsStore } from "@/stores/sessions";
import { patchSession } from "./chat-api";
import "./chat-context-bar.css";
import { executeSlashCommand } from "./slash-command-executor";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
const RESPONSE_USAGE_LEVELS = ["off", "tokens", "full"] as const;
type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export type ChatContextBarProps = {
  onToggleSearch?: () => void;
};

export function ChatContextBar({ onToggleSearch }: ChatContextBarProps = {}) {
  const t = useTranslations("chat");
  const ts = useTranslations("sessions");
  const activeSessionKey = useActiveSessionKey();
  const meta = useChatStore((state) =>
    activeSessionKey ? state.sessionMetas.find((item) => item.key === activeSessionKey) : undefined,
  );
  const sessionEntry = useSessionsStore((state) =>
    activeSessionKey ? state.sessions.find((item) => item.key === activeSessionKey) : undefined,
  );
  const compactCommandState = useChatStore((state) =>
    activeSessionKey ? state.sessions.get(activeSessionKey)?.commandStates?.compact : undefined,
  );

  const contextWindow = sessionEntry?.contextTokens ?? meta?.contextTokens ?? 0;
  const totalTokens = sessionEntry?.totalTokens ?? meta?.totalTokens;
  const tokensIn = sessionEntry?.tokensIn ?? 0;
  const tokensOut = sessionEntry?.tokensOut ?? 0;
  const compactionCount = sessionEntry?.compactionCount ?? meta?.compactionCount ?? 0;
  const usedTokens = totalTokens ?? tokensIn + tokensOut;
  const pct = contextPct({ contextWindow, tokensIn, tokensOut, totalTokens });
  const pressure = pressureState(pct);
  const tone = pct >= 95 ? "error" : pct >= 80 ? "warn" : "ok";

  const hasTranslation = (key: string) => typeof t.has === "function" && t.has(key);
  const tFallback = (key: string, fallback: string) => (hasTranslation(key) ? t(key) : fallback);
  const showToast = useCallback(
    (type: "info" | "success" | "warning" | "error", key: string, value?: string) => {
      const message = value ? t(key, { value }) : t(key);
      useNotificationsStore.getState().addToast(type, message, 3000);
    },
    [t],
  );

  const updateMetas = (sessionKey: string, updater: (target: SessionMeta) => SessionMeta) => {
    useChatStore.setState((state) => {
      const metas = state.sessionMetas.map((entry) =>
        entry.key === sessionKey ? updater(entry) : entry,
      );
      return { sessionMetas: metas, sessionMeta: metas };
    });
  };

  const handleToggleFast = () => {
    if (!activeSessionKey || !meta) {
      return;
    }
    const next = !meta.fastMode;
    updateMetas(activeSessionKey, (target) => ({ ...target, fastMode: next }));
    void patchSession(activeSessionKey, { fastMode: next });
  };

  const handleCycleThinking = () => {
    if (!activeSessionKey || !meta) {
      return;
    }
    const current = meta.thinkingLevel ?? "off";
    const index = THINKING_LEVELS.indexOf(current as ThinkingLevel);
    const next = THINKING_LEVELS[(index + 1) % THINKING_LEVELS.length];
    updateMetas(activeSessionKey, (target) => ({
      ...target,
      thinkingLevel: next === "off" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { thinkingLevel: next === "off" ? null : next });
  };

  const handleCycleUsage = () => {
    if (!activeSessionKey || !meta) {
      return;
    }
    const current = meta.responseUsage ?? "off";
    const index = RESPONSE_USAGE_LEVELS.indexOf(current);
    const next = RESPONSE_USAGE_LEVELS[(index + 1) % RESPONSE_USAGE_LEVELS.length];
    updateMetas(activeSessionKey, (target) => ({
      ...target,
      responseUsage: next === "off" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { responseUsage: next === "off" ? null : next });
  };

  const handleToggleSendPolicy = () => {
    if (!activeSessionKey || !meta) {
      return;
    }
    const current = meta.sendPolicy ?? "allow";
    const next = current === "allow" ? "deny" : "allow";
    updateMetas(activeSessionKey, (target) => ({
      ...target,
      sendPolicy: next === "allow" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { sendPolicy: next === "allow" ? null : next });
  };

  const compacting = compactCommandState?.status === "running";
  const compactStatus =
    compactCommandState?.status === "running"
      ? tFallback("commandCompactRunning", "Compaction running")
      : compactCommandState?.status === "completed"
        ? tFallback("commandCompactComplete", "Compaction complete")
        : compactCommandState?.status === "failed"
          ? tFallback("commandCompactFailed", "Compaction failed")
          : null;
  const compactError = compactCommandState?.status === "failed" ? compactCommandState.error : null;

  const handleCompact = () => {
    if (!activeSessionKey || compacting) {
      return;
    }
    void executeSlashCommand(activeSessionKey, "compact", "")
      .then((result) => {
        if (result.toastKey) {
          showToast(result.toastType ?? "info", result.toastKey, result.toastValue);
        }
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        showToast("error", "toastCompactFailed", reason);
      });
  };

  const model = meta?.model ?? tFallback("configModelDefault", "default");
  const thinkingLevel = (meta?.thinkingLevel ?? "off") as ThinkingLevel;
  const usageLevel = meta?.responseUsage ?? "off";
  const sendPolicy = meta?.sendPolicy ?? "allow";
  const optionLabel = (prefix: string, value: string) => tFallback(`${prefix}_${value}`, value);

  return (
    <div className="ds-chat-context-bar" role="toolbar">
      <div
        className="ds-chat-context-bar__cell"
        title={`${formatTokens(usedTokens)} / ${formatTokens(contextWindow)} tokens`}
      >
        <span className="ds-chat-context-bar__key">{tFallback("configModel", "Model")}</span>
        <span className="ds-chat-context-bar__val">{model}</span>
      </div>

      <div
        className="ds-chat-context-bar__cell ds-chat-context-bar__cell--bar"
        data-pressure={pressure}
        title={`${formatTokens(usedTokens)} / ${formatTokens(contextWindow)} tokens`}
      >
        <span className="ds-chat-context-bar__key">{tFallback("contextLabel", "Context")}</span>
        <span className="ds-chat-context-bar__bar" data-tone={tone}>
          <span className="ds-chat-context-bar__fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="ds-chat-context-bar__val">{pct}%</span>
      </div>

      <div className="ds-chat-context-bar__cell">
        <span className="ds-chat-context-bar__key">
          {tFallback("configCompactions", "Compactions")}
        </span>
        <span className="ds-chat-context-bar__val">{compactionCount}</span>
      </div>

      <button
        type="button"
        className="ds-chat-context-bar__cell ds-chat-context-bar__cell--button"
        title={tFallback("configReasoningToggle", "Click to cycle thinking level")}
        onClick={handleCycleThinking}
        disabled={!activeSessionKey || !meta}
      >
        <span className="ds-chat-context-bar__key">
          {tFallback("configReasoning", "Reasoning")}
        </span>
        <span className="ds-chat-context-bar__val">
          {optionLabel("configLevel", thinkingLevel)}
        </span>
      </button>

      <button
        type="button"
        className="ds-chat-context-bar__cell ds-chat-context-bar__cell--button"
        title={tFallback("configSendPolicyToggle", "Click to toggle send policy")}
        onClick={handleToggleSendPolicy}
        disabled={!activeSessionKey || !meta}
      >
        <span className="ds-chat-context-bar__key">{tFallback("configSendPolicy", "Send")}</span>
        <span className="ds-chat-context-bar__val">
          {sendPolicy === "deny"
            ? tFallback("configDeny", "deny")
            : tFallback("configAllow", "allow")}
        </span>
      </button>

      <button
        type="button"
        className="ds-chat-context-bar__cell ds-chat-context-bar__cell--button"
        title={tFallback("configUsageToggle", "Click to cycle response usage")}
        onClick={handleCycleUsage}
        disabled={!activeSessionKey || !meta}
      >
        <span className="ds-chat-context-bar__key">{tFallback("configUsage", "Usage")}</span>
        <span className="ds-chat-context-bar__val">
          {optionLabel("configUsageValue", usageLevel)}
        </span>
      </button>

      {meta?.fastMode ? (
        <button
          type="button"
          className="ds-chat-context-bar__chip ds-chat-context-bar__chip--warn"
          title={tFallback("configFastToggle", "Click to toggle fast mode")}
          onClick={handleToggleFast}
        >
          <ZapIcon className="ds-chat-context-bar__chip-icon" aria-hidden="true" />
          <span>{tFallback("configFast", "Fast")}</span>
        </button>
      ) : (
        <button
          type="button"
          className="ds-chat-context-bar__chip ds-chat-context-bar__chip--ghost"
          title={tFallback("configFastToggle", "Click to toggle fast mode")}
          onClick={handleToggleFast}
          disabled={!activeSessionKey || !meta}
        >
          <ZapIcon className="ds-chat-context-bar__chip-icon" aria-hidden="true" />
          <span>{tFallback("configFast", "Fast")}</span>
        </button>
      )}

      <span className="ds-chat-context-bar__grow" />

      {pct >= 60 && activeSessionKey ? (
        <button
          type="button"
          className="ds-chat-context-bar__compact-action"
          onClick={handleCompact}
          disabled={compacting}
        >
          <MinusIcon />
          {compacting ? ts("compacting") : ts("compact")}
        </button>
      ) : null}

      {compactStatus ? (
        <span
          className="ds-chat-context-bar__command-status"
          data-status={compactCommandState?.status}
          role={compactCommandState?.status === "failed" ? "alert" : "status"}
          title={compactError ?? compactCommandState?.summary}
        >
          {compactError ? `${compactStatus}: ${compactError}` : compactStatus}
        </span>
      ) : null}

      {onToggleSearch ? (
        <button
          type="button"
          className="ds-chat-context-bar__search-btn"
          onClick={onToggleSearch}
          title={tFallback("searchTranscript", "Search transcript")}
        >
          <SearchIcon className="ds-chat-context-bar__search-icon" aria-hidden="true" />
          <span className="ds-chat-context-bar__kbd" aria-hidden="true">
            ⌘F
          </span>
        </button>
      ) : null}
    </div>
  );
}
