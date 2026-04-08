"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "@/stores/chat";
import type { ChatMessage } from "@/stores/chat-types";

/**
 * In-session transcript search with match highlighting and navigation.
 * Activated by Cmd/Ctrl+F when the chat panel is focused.
 */
export function TranscriptSearch({ onClose }: { onClose: () => void }) {
  const t = useTranslations("chat");
  const [query, setQuery] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const messages = useChatStore(
    (s) => (activeSessionKey ? s.sessions.get(activeSessionKey)?.messages : undefined) ?? [],
  );

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: { messageIdx: number; message: ChatMessage }[] = [];
    messages.forEach((msg, idx) => {
      const text = extractText(msg);
      if (text.toLowerCase().includes(q)) {
        results.push({ messageIdx: idx, message: msg });
      }
    });
    return results;
  }, [query, messages]);

  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      setCurrentIdx((prev) => (prev + direction + matches.length) % matches.length);
    },
    [matches.length],
  );

  // Scroll to current match
  useEffect(() => {
    if (matches.length === 0) return;
    const match = matches[currentIdx];
    if (!match) return;
    // Requires parent message list to set data-message-idx={idx} on each message wrapper.
    // TODO: Add data-message-idx to MessageList render during ChatPanel integration.
    const el = document.querySelector(`[data-message-idx="${match.messageIdx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIdx, matches]);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-b"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <Search size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrentIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          } else if (e.key === "Enter") {
            navigate(e.shiftKey ? -1 : 1);
          }
        }}
        placeholder={t("searchTranscript")}
        className="flex-1 text-xs bg-transparent outline-none"
        style={{ color: "var(--foreground)" }}
      />
      {query && (
        <span
          className="text-[10px] whitespace-nowrap"
          style={{ color: "var(--muted-foreground)" }}
        >
          {matches.length > 0 ? `${currentIdx + 1}/${matches.length}` : t("noSearchResults")}
        </span>
      )}
      <button type="button" onClick={() => navigate(-1)} disabled={matches.length === 0}>
        <ChevronUp size={14} style={{ color: "var(--muted-foreground)" }} />
      </button>
      <button type="button" onClick={() => navigate(1)} disabled={matches.length === 0}>
        <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />
      </button>
      <button type="button" onClick={onClose}>
        <X size={14} style={{ color: "var(--muted-foreground)" }} />
      </button>
    </div>
  );
}

/** Extract searchable text from a ChatMessage. */
function extractText(msg: ChatMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((block) => {
        if (typeof block === "string") return block;
        if (typeof block === "object" && block !== null && "text" in block) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join(" ");
  }
  return "";
}

// Search highlight state is managed via useChatStore.searchQuery (to be added
// during ChatPanel integration) to avoid module-level mutable state and SSR
// state leakage. Components can read the query via store selector and wrap
// matching text in <mark> elements.
