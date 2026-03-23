"use client";

import { Bot, ChevronRight, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore, type ChatMessage, type ToolUseBlock } from "@/stores/chat";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import type { RunMetadata } from "@/stores/chat-types";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { RunStatusBar } from "./RunStatusBar";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Collapsible wrapper — shows a summary line when collapsed. */
function CollapsedBlock({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return <>{children}</>;
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-1 text-[10px] px-2 py-1 mb-1 rounded-md cursor-pointer bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      <ChevronRight size={10} />
      {label} ({count})
    </button>
  );
}

function ToolUseWithResult({ tool, streaming }: { tool: ToolUseBlock; streaming?: boolean }) {
  return (
    <>
      <ToolUseCard
        name={tool.name}
        input={tool.input}
        defaultOpen={tool.status === "running" || streaming}
      />
      {tool.result != null && (
        <ToolResultCard
          content={tool.result}
          isError={tool.isError}
          toolName={tool.name}
          toolInput={tool.input}
        />
      )}
    </>
  );
}

function MessageBubble({
  message,
  blockPrefs,
}: {
  message: ChatMessage;
  blockPrefs?: ChatBlockPreferences;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: isUser
            ? "color-mix(in srgb, var(--brand) 20%, transparent)"
            : "var(--bg-secondary)",
          color: isUser ? "var(--brand)" : "var(--text-secondary)",
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[75%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        {/* Thinking trace — collapse when filter is off */}
        {message.thinking &&
          (blockPrefs?.showThinking === false ? (
            <CollapsedBlock label="Thinking" count={1}>
              <ThinkingBlock text={message.thinking} />
            </CollapsedBlock>
          ) : (
            <ThinkingBlock text={message.thinking} />
          ))}

        {/* Tool use blocks — collapse when filter is off */}
        {message.toolUse &&
          message.toolUse.length > 0 &&
          (blockPrefs?.showToolUse === false ? (
            <CollapsedBlock label="Tools" count={message.toolUse.length}>
              {message.toolUse.map((tool, i) => (
                <ToolUseWithResult
                  key={tool.toolCallId ?? `${tool.name}-${i}`}
                  tool={tool}
                  streaming={message.streaming}
                />
              ))}
            </CollapsedBlock>
          ) : (
            message.toolUse.map((tool, i) => (
              <ToolUseWithResult
                key={tool.toolCallId ?? `${tool.name}-${i}`}
                tool={tool}
                streaming={message.streaming}
              />
            ))
          ))}

        {/* Main content */}
        {message.content && (
          <div
            className="rounded-lg px-3 py-2 text-sm leading-relaxed"
            style={{
              backgroundColor: isUser ? "var(--brand)" : "var(--bg-secondary)",
              color: isUser ? "var(--brand-fg)" : "var(--text-primary)",
            }}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-auto [&_pre]:text-xs [&_code]:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            )}
            {message.streaming && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm"
                style={{ backgroundColor: "var(--brand)" }}
              />
            )}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <span className="text-xs mt-1" style={{ color: "var(--status-disconnected)" }}>
            {message.error}
          </span>
        )}

        {/* Run metadata bar (model, tokens, duration) */}
        {!isUser && message.runMetadata?.model && (
          <RunStatusBar
            metadata={
              {
                runId: message.id,
                model: message.runMetadata.model,
                usage: message.runMetadata.usage,
                durationMs: message.runMetadata.durationMs,
                startedAt: message.runMetadata.startedAt,
                streaming: message.streaming,
              } satisfies RunMetadata
            }
          />
        )}

        {/* Timestamp */}
        <span className="text-[10px] mt-0.5 px-1" style={{ color: "var(--text-secondary)" }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
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
  const { messages, isStreaming } = useChatStore();
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
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("noMessages")}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3" onScroll={handleScroll}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} blockPrefs={blockPreferences} />
      ))}

      {/* Streaming indicator when waiting for first delta */}
      {isStreaming && !messages.some((m) => m.streaming) && (
        <div
          className="flex items-center gap-2 mb-4 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <Bot size={14} />
          <span className="animate-pulse">{t("thinking")}</span>
        </div>
      )}
    </div>
  );
}
