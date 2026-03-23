"use client";

import { Bot, User, Wrench, Brain, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore, type ChatMessage, type ToolUseBlock } from "@/stores/chat";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs">
      <summary
        className="flex items-center gap-1 cursor-pointer select-none"
        style={{ color: "var(--text-secondary)" }}
      >
        <Brain size={12} />
        {t("thinking")}
      </summary>
      <pre
        className="mt-1 p-2 rounded text-xs whitespace-pre-wrap overflow-auto"
        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
      >
        {text}
      </pre>
    </details>
  );
}

function ToolStatusIcon({ status }: { status?: string }) {
  if (status === "running") {
    return <Loader2 size={12} className="animate-spin text-[var(--accent)]" />;
  }
  if (status === "error") {
    return <XCircle size={12} className="text-[var(--danger)]" />;
  }
  if (status === "completed") {
    return <CheckCircle2 size={12} className="text-[var(--success)]" />;
  }
  return <Wrench size={12} />;
}

function ToolUseCard({ tool }: { tool: ToolUseBlock }) {
  const t = useTranslations("chat");
  const isRunning = tool.status === "running";
  return (
    <details
      className="my-1.5 text-xs border rounded"
      style={{ borderColor: "var(--border)" }}
      open={isRunning}
    >
      <summary
        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none"
        style={{ color: "var(--text-secondary)" }}
      >
        <ToolStatusIcon status={tool.status} />
        <span className="font-medium">{t("toolUse")}:</span>
        <code className="font-mono">{tool.name}</code>
      </summary>
      <div className="px-2 pb-2">
        {Object.keys(tool.input).length > 0 && (
          <pre
            className="mt-1 p-2 rounded text-xs overflow-auto"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        )}
        {tool.result && (
          <pre
            className="mt-1 p-2 rounded text-xs overflow-auto"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: tool.isError ? "var(--danger)" : "var(--text-primary)",
            }}
          >
            {tool.result}
          </pre>
        )}
      </div>
    </details>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} mb-4`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: isUser
            ? "color-mix(in srgb, var(--accent) 20%, transparent)"
            : "var(--bg-secondary)",
          color: isUser ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[75%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        {/* Thinking trace */}
        {message.thinking && <ThinkingBlock text={message.thinking} />}

        {/* Tool use blocks */}
        {message.toolUse?.map((tool, i) => (
          <ToolUseCard key={`${tool.name}-${i}`} tool={tool} />
        ))}

        {/* Main content */}
        {message.content && (
          <div
            className="rounded-lg px-3 py-2 text-sm leading-relaxed"
            style={{
              backgroundColor: isUser ? "var(--accent)" : "var(--bg-secondary)",
              color: isUser ? "var(--accent-fg)" : "var(--text-primary)",
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
                style={{ backgroundColor: "var(--accent)" }}
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

export function MessageList() {
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
        <MessageBubble key={msg.id} message={msg} />
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
