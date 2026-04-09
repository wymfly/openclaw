"use client";

import { Bot, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { useSessionMessages, useSessionStreaming } from "@/stores/chat-hooks";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import type { ChatMessage, RunMetadata } from "@/stores/chat-types";
import { CompactionNotice } from "./CompactionNotice";
import { MessageActions } from "./MessageActions";
import { RunStatusBar } from "./RunStatusBar";
import { TranscriptBlocks } from "./TranscriptBlocks";

// Stable empty reference to avoid Zustand infinite re-render
const STABLE_EMPTY_RUN_META: Record<string, RunMetadata> = {};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Extract plain text from a ChatMessage for copy actions. */
function extractPlainText(message: ChatMessage): string {
  return message.content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      return "";
    })
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
}: {
  message: ChatMessage;
  blockPrefs?: ChatBlockPreferences;
  runMetadata?: RunMetadata;
  sessionTotalTokens?: number;
  sessionCostUsd?: number;
  sessionStatus?: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
  sessionStreaming: boolean;
  partialResultLabel: string;
}) {
  const isUser = message.role === "user";
  const showPartialResult = !isUser && message.streaming && !sessionStreaming;

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} mb-4 group/msg`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: isUser
            ? "color-mix(in srgb, var(--primary) 20%, transparent)"
            : "var(--card)",
          color: isUser ? "var(--primary)" : "var(--muted-foreground)",
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div
        className={`flex flex-col min-w-0 ${isUser ? "items-end max-w-[75%]" : "items-start max-w-[90%]"}`}
      >
        <TranscriptBlocks
          message={message}
          isUser={isUser}
          streaming={message.streaming}
          blockPreferences={blockPrefs}
        />

        {/* Error */}
        {message.error && (
          <span className="text-xs mt-1" style={{ color: "var(--status-disconnected)" }}>
            {message.error}
          </span>
        )}

        {/* Run metadata bar (model, tokens, duration) */}
        {!isUser && runMetadata?.model && (
          <RunStatusBar
            metadata={runMetadata}
            sessionTotalTokens={sessionTotalTokens}
            sessionCostUsd={sessionCostUsd}
            sessionStatus={sessionStatus}
          />
        )}

        {showPartialResult && (
          <span className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            {partialResultLabel}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[10px] mt-0.5 px-1" style={{ color: "var(--muted-foreground)" }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>

        {/* Message actions (assistant messages only) */}
        {!isUser && <MessageActions content={extractPlainText(message)} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

/** Threshold in pixels: if user is within this distance from bottom, auto-scroll. */
const NEAR_BOTTOM_PX = 80;

export function MessageList({ blockPreferences }: { blockPreferences?: ChatBlockPreferences }) {
  const t = useTranslations("chat");
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();

  // Read runMetadata from the active session state
  const sessionRunMetadata = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key
      ? (s.sessions.get(key)?.runMetadata ?? STABLE_EMPTY_RUN_META)
      : STABLE_EMPTY_RUN_META;
  });

  // Read session-level cumulative tokens/cost from sessionMetas (synced via SSE)
  const sessionMeta = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key ? s.sessionMetas.find((m) => m.key === key) : undefined;
  });
  const sessionStatus = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key ? s.sessions.get(key)?.status : undefined;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track whether user is near the bottom.
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  // Auto-scroll when messages change (only if near bottom).
  useEffect(() => {
    const el = containerRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noMessages")}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3" onScroll={handleScroll}>
      {messages.map((msg, idx) => {
        // Render compaction notices as system cards (not message bubbles)
        if (msg.role === "system" && msg.id.startsWith("compaction-")) {
          return <CompactionNotice key={msg.id} timestamp={msg.timestamp} />;
        }

        // Build RunMetadata from session state for this message
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

        return (
          <div key={msg.id} data-message-idx={idx}>
            <MessageBubble
              message={msg}
              blockPrefs={blockPreferences}
              runMetadata={runMeta}
              sessionTotalTokens={sessionMeta?.totalTokens}
              sessionCostUsd={sessionMeta?.estimatedCostUsd}
              sessionStatus={sessionStatus}
              sessionStreaming={isStreaming}
              partialResultLabel={t("partialResult")}
            />
          </div>
        );
      })}

      {/* Streaming indicator when waiting for first delta */}
      {isStreaming && !messages.some((m) => m.streaming) && (
        <div
          className="flex items-center gap-2 mb-4 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Bot size={14} />
          <span className="animate-pulse">{t("thinking")}</span>
        </div>
      )}
    </div>
  );
}
