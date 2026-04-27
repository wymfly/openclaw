import { useTranslations } from "next-intl";
import { BanIcon, BarChartIcon, BrainIcon, CpuIcon, FileCodeIcon, ZapIcon } from "@/deck-ui/icons";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { patchSession } from "./chat-api";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
const RESPONSE_USAGE_LEVELS = ["off", "tokens", "full"] as const;
type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export function SessionConfigBar(
  props: {
    sessionKey?: string | null;
    meta?: SessionMeta | null;
  } = {},
) {
  if (props.sessionKey !== undefined || props.meta !== undefined) {
    return <SessionConfigBarView sessionKey={props.sessionKey ?? null} meta={props.meta ?? null} />;
  }

  return <StoreConnectedSessionConfigBar />;
}

function StoreConnectedSessionConfigBar() {
  const activeSessionKey = useActiveSessionKey();
  const meta = useChatStore((state) =>
    state.sessionMetas.find((sessionMeta) => sessionMeta.key === activeSessionKey),
  );
  return <SessionConfigBarView sessionKey={activeSessionKey} meta={meta ?? null} />;
}

function SessionConfigBarView({
  sessionKey,
  meta,
}: {
  sessionKey: string | null;
  meta: SessionMeta | null;
}) {
  const t = useTranslations("chat");

  if (!sessionKey || !meta) {
    return null;
  }

  const updateMetas = (updater: (target: SessionMeta) => SessionMeta) => {
    useChatStore.setState((state) => {
      const metas = state.sessionMetas.map((entry) =>
        entry.key === sessionKey ? updater(entry) : entry,
      );
      return { sessionMetas: metas, sessionMeta: metas };
    });
  };

  const handleToggleFast = () => {
    const next = !meta.fastMode;
    updateMetas((target) => ({ ...target, fastMode: next }));
    void patchSession(sessionKey, { fastMode: next });
  };

  const handleCycleThinking = () => {
    const current = meta.thinkingLevel ?? "off";
    const index = THINKING_LEVELS.indexOf(current as (typeof THINKING_LEVELS)[number]);
    const next = THINKING_LEVELS[(index + 1) % THINKING_LEVELS.length];
    updateMetas((target) => ({
      ...target,
      thinkingLevel: next === "off" ? undefined : next,
    }));
    void patchSession(sessionKey, { thinkingLevel: next === "off" ? null : next });
  };

  const handleCycleUsage = () => {
    const current = meta.responseUsage ?? "off";
    const index = RESPONSE_USAGE_LEVELS.indexOf(current);
    const next = RESPONSE_USAGE_LEVELS[(index + 1) % RESPONSE_USAGE_LEVELS.length];
    updateMetas((target) => ({
      ...target,
      responseUsage: next === "off" ? undefined : next,
    }));
    void patchSession(sessionKey, { responseUsage: next === "off" ? null : next });
  };

  const handleToggleSendPolicy = () => {
    const current = meta.sendPolicy ?? "allow";
    const next = current === "allow" ? "deny" : "allow";
    updateMetas((target) => ({
      ...target,
      sendPolicy: next === "allow" ? undefined : next,
    }));
    void patchSession(sessionKey, { sendPolicy: next === "allow" ? null : next });
  };

  const model = meta.model ?? t("configModelDefault");
  const thinkingLevel = (meta.thinkingLevel ?? "off") as ThinkingLevel;
  const usageLevel = meta.responseUsage ?? "off";
  const optionLabel = (prefix: string, value: string) => {
    const key = `${prefix}_${value}`;
    return typeof t.has === "function" && t.has(key) ? t(key) : value;
  };

  return (
    <div className="deck-ui-session-config">
      <span className="deck-ui-session-config-model">
        <CpuIcon />
        {t("configModel")} <strong>{model}</strong>
      </span>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configThinkingToggle")}
        onClick={handleCycleThinking}
      >
        <BrainIcon />
        {t("configThinking")} {optionLabel("configLevel", thinkingLevel)}
      </button>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configFastToggle")}
        onClick={handleToggleFast}
      >
        <ZapIcon />
        {t("configFast")} {meta.fastMode ? t("configOn") : t("configOff")}
      </button>

      {meta.verboseLevel ? (
        <span className="deck-ui-session-config-pill">
          <FileCodeIcon />
          {t("configVerbose")} {meta.verboseLevel}
        </span>
      ) : null}

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configUsageToggle")}
        onClick={handleCycleUsage}
      >
        <BarChartIcon />
        {t("configUsage")} {optionLabel("configUsageValue", usageLevel)}
      </button>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configSendPolicyToggle")}
        onClick={handleToggleSendPolicy}
      >
        <BanIcon />
        {t("configSendPolicy")} {meta.sendPolicy === "deny" ? t("configDeny") : t("configAllow")}
      </button>
    </div>
  );
}
