import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { BotIcon, UserIcon } from "@/deck-ui/icons";
import { useChatStore } from "@/stores/chat";
import { useSessionMessages, useSessionStreaming } from "@/stores/chat-hooks";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import type { ChatMessage, RunMetadata } from "@/stores/chat-types";
import { CompactionNotice } from "./CompactionNotice";
import "./chat-message.css";
import { MessageActions } from "./MessageActions";
import { RunStatusBar } from "./RunStatusBar";
import { TranscriptBlocks } from "./TranscriptBlocks";

const STABLE_EMPTY_RUN_META: Record<string, RunMetadata> = {};
const NEAR_BOTTOM_PX = 80;

function extractPlainText(message: ChatMessage): string {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

function MessageBubble({
  message,
  blockPrefs,
  runMetadata,
  sessionTotalTokens,
  sessionCostUsd,
  sessionStatus,
  sessionStreaming,
  partialResultLabel,
  roleLabel,
  streamingLabel,
}: {
  message: ChatMessage;
  blockPrefs?: ChatBlockPreferences;
  runMetadata?: RunMetadata;
  sessionTotalTokens?: number;
  sessionCostUsd?: number;
  sessionStatus?: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
  sessionStreaming: boolean;
  partialResultLabel: string;
  roleLabel: string;
  streamingLabel: string;
}) {
  const isUser = message.role === "user";
  const showPartialResult = !isUser && message.streaming && !sessionStreaming;

  return (
    <div
      className={`ds-chat-message ${isUser ? "ds-chat-message--user" : "ds-chat-message--assistant"} deck-ui-message ${isUser ? "is-user" : "is-assistant"}`}
      aria-label={`${isUser ? "User" : "Assistant"} message`}
    >
      <div className="ds-chat-message__avatar deck-ui-message-avatar" aria-hidden="true">
        {isUser ? <UserIcon /> : <BotIcon />}
      </div>
      <div className="ds-chat-message__body deck-ui-message-body">
        <div className="ds-chat-message__bubble">
          <TranscriptBlocks
            message={message}
            isUser={isUser}
            streaming={message.streaming}
            blockPreferences={blockPrefs}
          />
        </div>
        {message.error ? (
          <span className="ds-chat-message__error deck-ui-message-error">{message.error}</span>
        ) : null}
        {!isUser && runMetadata ? (
          <RunStatusBar
            metadata={runMetadata}
            sessionTotalTokens={message.streaming ? sessionTotalTokens : undefined}
            sessionCostUsd={message.streaming ? sessionCostUsd : undefined}
            sessionStatus={message.streaming ? sessionStatus : undefined}
          />
        ) : null}
        {showPartialResult ? (
          <span className="ds-chat-message__partial deck-ui-partial-result">
            {partialResultLabel}
          </span>
        ) : null}
        <span className="ds-chat-message__meta-line deck-ui-message-time">
          <span className="ds-chat-message__role">{roleLabel}</span>
          <span className="ds-chat-message__dot-sep" aria-hidden="true">
            ·
          </span>
          <span className="ds-chat-message__time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.streaming ? (
            <>
              <span className="ds-chat-message__dot-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-chat-message__streaming-dot">{streamingLabel}</span>
            </>
          ) : null}
        </span>
        {!isUser ? <MessageActions content={extractPlainText(message)} /> : null}
      </div>
    </div>
  );
}

export function MessageList({ blockPreferences }: { blockPreferences?: ChatBlockPreferences }) {
  const t = useTranslations("chat");
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const sessionRunMetadata = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key
      ? (s.sessions.get(key)?.runMetadata ?? STABLE_EMPTY_RUN_META)
      : STABLE_EMPTY_RUN_META;
  });
  const sessionMeta = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key ? s.sessionMetas.find((m) => m.key === key) : undefined;
  });
  const sessionStatus = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key ? s.sessions.get(key)?.status : undefined;
  });

  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const userRoleLabel = t("msgRoleYou");
  const assistantRoleLabel = t("msgRoleAssistant");
  const streamingLabel = t("msgStreaming");

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return <p className="ds-chat-message-empty deck-ui-message-empty">{t("noMessages")}</p>;
  }

  return (
    <div
      className="ds-chat-message-list deck-ui-message-list"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {messages.map((msg, idx) => {
        if (msg.role === "system" && msg.id.startsWith("compaction-")) {
          return (
            <CompactionNotice
              key={msg.id}
              sessionKey={activeSessionKey}
              timestamp={msg.timestamp}
              tokensBefore={msg.tokensBefore}
              tokensAfter={msg.tokensAfter}
            />
          );
        }

        const meta = sessionRunMetadata[msg.id];
        const runMeta: RunMetadata | undefined = meta?.model
          ? {
              runId: msg.id,
              model: meta.model,
              usage: meta.usage,
              durationMs: meta.durationMs,
              startedAt: meta.startedAt,
              streaming: msg.streaming,
            }
          : undefined;
        const showSessionTotals = Boolean(
          msg.streaming &&
          ((sessionMeta?.totalTokens ?? 0) > 0 || (sessionMeta?.estimatedCostUsd ?? 0) > 0),
        );
        const effectiveRunMeta =
          runMeta ??
          (showSessionTotals
            ? ({
                runId: msg.id,
                streaming: msg.streaming,
              } satisfies RunMetadata)
            : undefined);

        return (
          <div
            className="ds-chat-message-frame deck-ui-message-frame"
            key={msg.id}
            data-message-idx={idx}
          >
            <MessageBubble
              message={msg}
              blockPrefs={blockPreferences}
              runMetadata={effectiveRunMeta}
              sessionTotalTokens={sessionMeta?.totalTokens}
              sessionCostUsd={sessionMeta?.estimatedCostUsd}
              sessionStatus={sessionStatus}
              sessionStreaming={isStreaming}
              partialResultLabel={t("partialResult")}
              roleLabel={msg.role === "user" ? userRoleLabel : assistantRoleLabel}
              streamingLabel={streamingLabel}
            />
          </div>
        );
      })}
      {isStreaming && !messages.some((m) => m.streaming) ? (
        <div className="ds-chat-message-frame deck-ui-message-frame">
          <div className="ds-chat-message-waiting deck-ui-waiting-message">
            <span className="ds-chat-message__avatar deck-ui-message-avatar" aria-hidden="true">
              <BotIcon />
            </span>
            <span className="ds-thinking-inline">{t("thinking")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
