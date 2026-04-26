import { useTranslations } from "next-intl";
import { useState } from "react";
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
      <span>{activeAgentId ?? "main"}</span>
      <strong>{activeSessionKey ?? noSessionLabel}</strong>
      <span>{messagesCountLabel}</span>
      <span>{isStreaming ? streamingLabel : idleLabel}</span>
      {contextWindow > 0 ? (
        <span
          data-pressure={pressure}
          title={`${formatTokens(usedTokens)} / ${formatTokens(contextWindow)} tokens`}
        >
          {t("contextLabel")}: {pct}%
        </span>
      ) : null}
      {pct >= 80 ? <span role="status">{t("contextWarning")}</span> : null}
      {compactionCount > 0 ? (
        <span title={t("contextCompacted", { count: compactionCount })}>
          {t("contextCompacted", { count: compactionCount })}
        </span>
      ) : null}
      {pct >= 60 && activeSessionKey ? (
        <button type="button" onClick={handleCompact} disabled={compacting}>
          {compacting ? ts("compacting") : ts("compact")}
        </button>
      ) : null}
      {compactError ? <span role="alert">{compactError}</span> : null}
    </div>
  );
}
