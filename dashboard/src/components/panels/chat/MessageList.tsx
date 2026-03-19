"use client";

import { Bot, User, Wrench, Brain, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useChatStore, type ChatMessage, type ToolUseBlock } from "@/stores/chat";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs group/thinking">
      <summary className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        <Brain size={12} />
        <span>{t("thinking")}</span>
      </summary>
      <pre className="mt-1.5 p-2.5 rounded-lg text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        {text}
      </pre>
    </details>
  );
}

function ToolUseCard({ tool }: { tool: ToolUseBlock }) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
        <Wrench size={12} className="shrink-0" />
        <span className="font-medium">{t("toolUse")}:</span>
        <code className="font-mono text-[var(--accent)]">{tool.name}</code>
      </summary>
      <div className="px-2.5 pb-2.5 border-t border-[var(--border-subtle)]">
        <pre className="mt-1.5 p-2 rounded-lg text-xs overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {JSON.stringify(tool.input, null, 2)}
        </pre>
        {tool.result && (
          <pre className="mt-1.5 p-2 rounded-lg text-xs overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
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
        {message.thinking && <ThinkingBlock text={message.thinking} />}

        {/* Tool use blocks */}
        {message.toolUse?.map((tool, i) => (
          <ToolUseCard key={`${tool.name}-${i}`} tool={tool} />
        ))}

        {/* Main bubble */}
        {message.content && (
          <div
            className={cn(
              "px-3.5 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-[var(--accent)] text-white rounded-2xl rounded-br-md"
                : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-2xl rounded-bl-md ring-1 ring-[var(--border-subtle)]",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-auto [&_pre]:text-xs [&_code]:text-xs [&_pre]:bg-[var(--bg-primary)] [&_pre]:rounded-lg [&_pre]:p-2.5 [&_code]:font-mono">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            )}
            {message.streaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm bg-current opacity-70" />
            )}
          </div>
        )}

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
  const { messages, isStreaming } = useChatStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

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
    <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4" onScroll={handleScroll}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
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
  );
}
