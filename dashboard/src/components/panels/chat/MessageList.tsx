"use client";

import { Bot, User, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ChatMessage, ContentBlock } from "@/stores/chat";
import { useSessionMessages, useSessionStreaming } from "@/stores/chat-hooks";
import {
  loadBlockPreferences,
  saveBlockPreferences,
  type ChatBlockPreferences,
} from "@/stores/chat-preferences";
import { BlockFilterBar } from "./BlockFilterBar";
import { FileBlock } from "./blocks/FileBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { ToolUseCard } from "./blocks/ToolUseCard";

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                       */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  preferences,
}: {
  message: ChatMessage;
  preferences: ChatBlockPreferences;
}) {
  const isUser = message.role === "user";

  // Apply block filter preferences
  const filteredContent = message.content.filter((b) => {
    if (b.type === "thinking" && !preferences.showThinking) {
      return false;
    }
    if (b.type === "tool_use" && !preferences.showToolUse) {
      return false;
    }
    if (b.type === "tool_result" && !preferences.showToolResult) {
      return false;
    }
    return true;
  });

  // Skip rendering if all blocks are filtered out (avoid empty message shells)
  if (filteredContent.length === 0 && !message.error) {
    return null;
  }

  // Group content blocks by type
  const thinkingBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "thinking" } => b.type === "thinking",
  );
  const imageBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "image" } => b.type === "image",
  );
  const fileBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "file" } => b.type === "file",
  );
  const textBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "text" } => b.type === "text",
  );
  const toolUseBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use",
  );
  const toolResultBlocks = filteredContent.filter(
    (b): b is ContentBlock & { type: "tool_result" } => b.type === "tool_result",
  );

  // Build a lookup from toolUseId -> tool name for contextual artifact detection
  // Uses original content (not filtered) so toolName is available even when tool_use is hidden
  const toolUseNameMap = new Map(
    message.content
      .filter((b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use")
      .map((b) => [b.id, b.name]),
  );

  const combinedText = textBlocks.map((b) => b.text).join("\n");

  return (
    <div className={cn("flex gap-3 mb-5 transition-panel", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center ring-1",
          isUser
            ? "bg-[var(--accent-muted)] text-[var(--accent)] ring-[var(--accent)]/20"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-[var(--border)]",
        )}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content column */}
      <div
        className={cn("flex flex-col max-w-[75%] min-w-0", isUser ? "items-end" : "items-start")}
      >
        {/* Thinking trace */}
        {thinkingBlocks.map((b, i) => (
          <ThinkingBlock key={`think-${i}`} text={b.text} />
        ))}

        {/* Attachment strip — images and files */}
        {(imageBlocks.length > 0 || fileBlocks.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {imageBlocks.map((b, i) => (
              <ImageBlock
                key={`img-${i}`}
                data={b.data}
                mimeType={b.mimeType}
                fileName={b.fileName}
              />
            ))}
            {fileBlocks.map((b, i) => (
              <FileBlock
                key={`file-${i}`}
                data={b.data}
                mimeType={b.mimeType}
                fileName={b.fileName}
                size={b.size}
              />
            ))}
          </div>
        )}

        {/* Main text bubble */}
        {combinedText && (
          <div
            className={cn(
              "px-3.5 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-[var(--accent)] text-white rounded-2xl rounded-br-md"
                : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-2xl rounded-bl-md ring-1 ring-[var(--border-subtle)]",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{combinedText}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-auto [&_pre]:text-xs [&_code]:text-xs [&_pre]:bg-[var(--bg-primary)] [&_pre]:rounded-lg [&_pre]:p-2.5 [&_code]:font-mono">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{combinedText}</ReactMarkdown>
              </div>
            )}
            {message.streaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm bg-current opacity-70" />
            )}
          </div>
        )}

        {/* Tool use cards */}
        {toolUseBlocks.map((b, i) => (
          <ToolUseCard key={`tool-${i}`} name={b.name} input={b.input} />
        ))}

        {/* Tool result cards */}
        {toolResultBlocks.map((b, i) => (
          <ToolResultCard
            key={`result-${i}`}
            content={typeof b.content === "string" ? b.content : JSON.stringify(b.content)}
            isError={b.isError}
            toolName={toolUseNameMap.get(b.toolUseId)}
          />
        ))}

        {/* Error */}
        {message.error && (
          <span className="text-xs mt-1.5 px-2 py-0.5 rounded bg-[var(--danger-muted)] text-[var(--danger-muted-text)]">
            {message.error}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[10px] mt-1 px-1 text-[var(--text-secondary)] font-mono">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageList                                                        */
/* ------------------------------------------------------------------ */

const NEAR_BOTTOM_PX = 80;

export function MessageList() {
  const t = useTranslations("chat");
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [blockPrefs, setBlockPrefs] = useState<ChatBlockPreferences>(loadBlockPreferences);

  const handlePrefsChange = (prefs: ChatBlockPreferences) => {
    setBlockPrefs(prefs);
    saveBlockPreferences(prefs);
  };

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

  /* Empty state */
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <MessageSquare size={20} className="text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t("noMessages")}</p>
          <p className="text-xs mt-0.5">{t("placeholder")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <BlockFilterBar preferences={blockPrefs} onChange={handlePrefsChange} />
      <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4" onScroll={handleScroll}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} preferences={blockPrefs} />
        ))}

        {/* Streaming indicator when waiting for first delta */}
        {isStreaming && !messages.some((m) => m.streaming) && (
          <div className="flex items-center gap-2.5 mb-4 text-xs text-[var(--text-secondary)]">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border)]">
              <Bot size={14} />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-md bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
              <span className="animate-pulse">{t("thinking")}</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
