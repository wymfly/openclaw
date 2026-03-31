"use client";

import { Bot, ChevronRight, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { useChatStore } from "@/stores/chat";
import { useSessionMessages, useSessionStreaming } from "@/stores/chat-hooks";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import {
  getTextContent,
  getThinkingContent,
  getToolUseBlocks,
  getToolResultBlocks,
} from "@/stores/chat-types";
import type { ContentBlock, ChatMessage, RunMetadata } from "@/stores/chat-types";
import { CompactionNotice } from "./CompactionNotice";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { RunStatusBar } from "./RunStatusBar";

// Stable empty reference to avoid Zustand infinite re-render
const STABLE_EMPTY_RUN_META: Record<string, RunMetadata> = {};

// ---------------------------------------------------------------------------
// Extracted types for tool rendering
// ---------------------------------------------------------------------------

type ToolUseContentBlock = Extract<ContentBlock, { type: "tool_use" }>;
type ToolResultContentBlock = Extract<ContentBlock, { type: "tool_result" }>;

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
      className="flex items-center gap-1 text-[10px] px-2 py-1 mb-1 rounded-md cursor-pointer bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
    >
      <ChevronRight size={10} />
      {label} ({count})
    </button>
  );
}

function ToolUseWithResult({
  tool,
  resultBlock,
  streaming,
}: {
  tool: ToolUseContentBlock;
  resultBlock?: ToolResultContentBlock;
  streaming?: boolean;
}) {
  // Derive status: if there's a matching tool_result → completed, else running (if streaming)
  const isRunning = !resultBlock && streaming;
  return (
    <>
      <ToolUseCard name={tool.name} input={tool.input} defaultOpen={isRunning || streaming} />
      {resultBlock != null && (
        <ToolResultCard
          content={
            typeof resultBlock.content === "string"
              ? resultBlock.content
              : JSON.stringify(resultBlock.content)
          }
          isError={resultBlock.isError}
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
  runMetadata,
}: {
  message: ChatMessage;
  blockPrefs?: ChatBlockPreferences;
  runMetadata?: RunMetadata;
}) {
  const isUser = message.role === "user";
  const textContent = getTextContent(message);
  const thinkingContent = getThinkingContent(message);
  const toolUseBlocks = getToolUseBlocks(message);
  const toolResultBlocks = getToolResultBlocks(message);

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
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
        {/* Thinking trace — collapse when filter is off */}
        {thinkingContent.length > 0 &&
          (blockPrefs?.showThinking === false ? (
            <CollapsedBlock label="Thinking" count={1}>
              <ThinkingBlock text={thinkingContent} />
            </CollapsedBlock>
          ) : (
            <ThinkingBlock text={thinkingContent} />
          ))}

        {/* Tool use blocks — collapse when filter is off */}
        {toolUseBlocks.length > 0 &&
          (blockPrefs?.showToolUse === false ? (
            <CollapsedBlock label="Tools" count={toolUseBlocks.length}>
              {toolUseBlocks.map((tool, i) => (
                <ToolUseWithResult
                  key={tool.id ?? `${tool.name}-${i}`}
                  tool={tool}
                  resultBlock={toolResultBlocks.find((r) => r.toolUseId === tool.id)}
                  streaming={message.streaming}
                />
              ))}
            </CollapsedBlock>
          ) : (
            toolUseBlocks.map((tool, i) => (
              <ToolUseWithResult
                key={tool.id ?? `${tool.name}-${i}`}
                tool={tool}
                resultBlock={toolResultBlocks.find((r) => r.toolUseId === tool.id)}
                streaming={message.streaming}
              />
            ))
          ))}

        {/* Main content */}
        {textContent && (
          <div
            className={`rounded-lg text-sm ${isUser ? "px-3 py-2" : "px-4 py-3"}`}
            style={{
              backgroundColor: isUser ? "var(--primary)" : "var(--card)",
              color: isUser ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{textContent}</p>
            ) : (
              <div className="chat-prose max-w-none text-sm">
                <Streamdown
                  mode={message.streaming ? "streaming" : "static"}
                  className="streamdown-chat"
                >
                  {textContent}
                </Streamdown>
              </div>
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
        {!isUser && runMetadata?.model && <RunStatusBar metadata={runMetadata} />}

        {/* Timestamp */}
        <span className="text-[10px] mt-0.5 px-1" style={{ color: "var(--muted-foreground)" }}>
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
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();

  // Read runMetadata from the active session state
  const sessionRunMetadata = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key
      ? (s.sessions.get(key)?.runMetadata ?? STABLE_EMPTY_RUN_META)
      : STABLE_EMPTY_RUN_META;
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
      {messages.map((msg) => {
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
          <MessageBubble
            key={msg.id}
            message={msg}
            blockPrefs={blockPreferences}
            runMetadata={runMeta}
          />
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
