"use client";

import { Ban, BarChart2, Brain, Cpu, Lightbulb, Terminal, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { patchSession } from "./chat-api";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
const REASONING_LEVELS = ["off", "on", "stream"] as const;
const RESPONSE_USAGE_LEVELS = ["off", "tokens", "full"] as const;

export function SessionConfigBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const meta = useChatStore((s) => s.sessionMetas.find((m) => m.key === activeSessionKey));

  if (!activeSessionKey || !meta) {
    return null;
  }

  const updateMetas = (updater: (target: SessionMeta) => SessionMeta) => {
    useChatStore.setState((s) => {
      const metas = s.sessionMetas.map((m) => (m.key === activeSessionKey ? updater(m) : m));
      return { sessionMetas: metas, sessionMeta: metas };
    });
  };

  const handleToggleFast = () => {
    const next = !meta.fastMode;
    updateMetas((target) => ({ ...target, fastMode: next }));
    void patchSession(activeSessionKey, { fastMode: next });
  };

  const handleCycleThinking = () => {
    const current = meta.thinkingLevel ?? "off";
    const idx = THINKING_LEVELS.indexOf(current as (typeof THINKING_LEVELS)[number]);
    const next = THINKING_LEVELS[(idx + 1) % THINKING_LEVELS.length];
    updateMetas((target) => ({
      ...target,
      thinkingLevel: next === "off" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { thinkingLevel: next === "off" ? null : next });
  };

  const handleCycleReasoning = () => {
    const current = meta.reasoningLevel ?? "off";
    const idx = REASONING_LEVELS.indexOf(current as (typeof REASONING_LEVELS)[number]);
    const next = REASONING_LEVELS[(idx + 1) % REASONING_LEVELS.length];
    updateMetas((target) => ({
      ...target,
      reasoningLevel: next === "off" ? undefined : next,
    }));
    // Gateway schema: reasoningLevel is string (no null); send "off" to clear.
    void patchSession(activeSessionKey, { reasoningLevel: next });
  };

  const handleCycleUsage = () => {
    const current = meta.responseUsage ?? "off";
    const idx = RESPONSE_USAGE_LEVELS.indexOf(current as (typeof RESPONSE_USAGE_LEVELS)[number]);
    const next = RESPONSE_USAGE_LEVELS[(idx + 1) % RESPONSE_USAGE_LEVELS.length];
    updateMetas((target) => ({
      ...target,
      responseUsage: next === "off" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { responseUsage: next === "off" ? null : next });
  };

  const handleToggleSendPolicy = () => {
    const current = meta.sendPolicy ?? "allow";
    const next = current === "allow" ? "deny" : "allow";
    updateMetas((target) => ({
      ...target,
      sendPolicy: next === "allow" ? undefined : next,
    }));
    void patchSession(activeSessionKey, { sendPolicy: next === "allow" ? null : next });
  };

  const model = meta.model ?? t("configModelDefault");
  const isDenied = meta.sendPolicy === "deny";

  return (
    <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-mono text-[var(--muted-foreground)] border-t border-[var(--border-subtle)]">
      <span className="flex items-center gap-1">
        <Cpu size={10} className="text-[var(--muted-foreground)]" />
        <span>{t("configModel")}</span>
        <span className="text-[var(--primary)]">{model}</span>
      </span>

      <button
        type="button"
        onClick={handleCycleThinking}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configThinkingToggle")}
      >
        <Brain size={10} />
        <span>{t("configThinking")}</span>
        <span className="text-[var(--primary)]">{meta.thinkingLevel ?? "off"}</span>
      </button>

      <button
        type="button"
        onClick={handleCycleReasoning}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configReasoningToggle")}
      >
        <Lightbulb size={10} />
        <span>{t("configReasoning")}</span>
        <span className="text-[var(--primary)]">{meta.reasoningLevel ?? "off"}</span>
      </button>

      <button
        type="button"
        onClick={handleToggleFast}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configFastToggle")}
      >
        <Zap size={10} />
        <span>{t("configFast")}</span>
        <span className="text-[var(--primary)]">
          {meta.fastMode ? t("configOn") : t("configOff")}
        </span>
      </button>

      <button
        type="button"
        onClick={handleCycleUsage}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        title={t("configUsageToggle")}
      >
        <BarChart2 size={10} />
        <span>{t("configUsage")}</span>
        <span className="text-[var(--primary)]">{meta.responseUsage ?? "off"}</span>
      </button>

      {meta.verboseLevel && (
        <span className="flex items-center gap-1">
          <Terminal size={10} />
          <span>{t("configVerbose")}</span>
          <span className="text-[var(--primary)]">{meta.verboseLevel}</span>
        </span>
      )}

      <button
        type="button"
        onClick={handleToggleSendPolicy}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
        style={isDenied ? { color: "var(--destructive)" } : undefined}
        title={t("configSendPolicyToggle")}
      >
        <Ban size={10} />
        <span>{t("configSendPolicy")}</span>
        <span style={isDenied ? { color: "var(--destructive)" } : { color: "var(--primary)" }}>
          {isDenied ? t("configDeny") : t("configAllow")}
        </span>
      </button>
    </div>
  );
}
