import { useTranslations } from "next-intl";
import { useState } from "react";
import { AlertTriangleIcon, MinusIcon } from "@/deck-ui/icons";
import { contextPct, formatTokens, pressureState } from "@/lib/context-utils";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionMessages, useSessionStreaming } from "@/stores/chat-hooks";
import { useSessionsStore } from "@/stores/sessions";
import { compactChatSession } from "./chat-api";

export function ChatContextBar() {
  const t = useTranslations("chat");
  const ts = useTranslations("sessions");
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const [compacting, setCompacting] = useState(false);
  const [compactError, setCompactError] = useState<string | null>(null);
  const meta = useChatStore((state) =>
    activeSessionKey ? state.sessionMetas.find((item) => item.key === activeSessionKey) : undefined,
  );
  const sessionEntry = useSessionsStore((state) =>
    activeSessionKey ? state.sessions.find((item) => item.key === activeSessionKey) : undefined,
  );
  const contextWindow = sessionEntry?.contextTokens ?? meta?.contextTokens ?? 0;
  const totalTokens = sessionEntry?.totalTokens ?? meta?.totalTokens;
  const tokensIn = sessionEntry?.tokensIn ?? 0;
  const tokensOut = sessionEntry?.tokensOut ?? 0;
  const compactionCount = sessionEntry?.compactionCount ?? meta?.compactionCount ?? 0;
  const usedTokens = totalTokens ?? tokensIn + tokensOut;
  const pct = contextPct({
    contextWindow,
    tokensIn,
    tokensOut,
    totalTokens,
  });
  const pressure = pressureState(pct);
  const hasTranslation = (key: string) => typeof t.has === "function" && t.has(key);
  const noSessionLabel = hasTranslation("noSession") ? t("noSession") : "No session";
  const messagesCountLabel = hasTranslation("messagesCount")
    ? t("messagesCount", { count: messages.length })
    : `${messages.length} messages`;
  const streamingLabel = hasTranslation("status_running") ? t("status_running") : "Streaming";
  const idleLabel = hasTranslation("status_idle") ? t("status_idle") : "Idle";

  const handleCompact = () => {
    if (!activeSessionKey || compacting) {
      return;
    }
    setCompacting(true);
    setCompactError(null);
    void compactChatSession(activeSessionKey)
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        setCompactError(ts("compactFailed", { reason }));
      })
      .finally(() => setCompacting(false));
  };

  return (
    <div className="deck-ui-context-strip">
      <span className="deck-ui-context-pill">{activeAgentId ?? "main"}</span>
      <strong className="deck-ui-context-session">{activeSessionKey ?? noSessionLabel}</strong>
      <span>{messagesCountLabel}</span>
      <span>{isStreaming ? streamingLabel : idleLabel}</span>
      {contextWindow > 0 ? (
        <span
          className="deck-ui-context-pressure"
          data-pressure={pressure}
          title={`${formatTokens(usedTokens)} / ${formatTokens(contextWindow)} tokens`}
        >
          <span>{t("contextLabel")}: </span>
          <span className="deck-ui-context-pressure-track">
            <span style={{ width: `${pct}%` }} />
          </span>
          <strong>{pct}%</strong>
        </span>
      ) : null}
      {pct >= 80 ? (
        <span className="deck-ui-context-warning" role="status">
          <AlertTriangleIcon />
          {t("contextWarning")}
        </span>
      ) : null}
      {compactionCount > 0 ? (
        <span
          className="deck-ui-context-compacted"
          title={t("contextCompacted", { count: compactionCount })}
        >
          <AlertTriangleIcon />
          {compactionCount}
          <span className="deck-ui-sr-only">
            {t("contextCompacted", { count: compactionCount })}
          </span>
        </span>
      ) : null}
      {pct >= 60 && activeSessionKey ? (
        <button type="button" onClick={handleCompact} disabled={compacting}>
          <MinusIcon />
          {compacting ? ts("compacting") : ts("compact")}
        </button>
      ) : null}
      {compactError ? <span role="alert">{compactError}</span> : null}
    </div>
  );
}
