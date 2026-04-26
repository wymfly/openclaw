import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { patchSession } from "./chat-api";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
const RESPONSE_USAGE_LEVELS = ["off", "tokens", "full"] as const;

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

  return (
    <div className="deck-ui-session-config">
      <span className="deck-ui-session-config-model">
        {t("configModel")} <strong>{model}</strong>
      </span>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configThinkingToggle")}
        onClick={handleCycleThinking}
      >
        {t("configThinking")} {meta.thinkingLevel ?? "off"}
      </button>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configFastToggle")}
        onClick={handleToggleFast}
      >
        {t("configFast")} {meta.fastMode ? t("configOn") : t("configOff")}
      </button>

      {meta.verboseLevel ? (
        <span className="deck-ui-session-config-pill">
          {t("configVerbose")} {meta.verboseLevel}
        </span>
      ) : null}

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configUsageToggle")}
        onClick={handleCycleUsage}
      >
        {t("configUsage")} {meta.responseUsage ?? "off"}
      </button>

      <button
        className="deck-ui-session-config-button"
        type="button"
        title={t("configSendPolicyToggle")}
        onClick={handleToggleSendPolicy}
      >
        {t("configSendPolicy")} {meta.sendPolicy === "deny" ? t("configDeny") : t("configAllow")}
      </button>
    </div>
  );
}
