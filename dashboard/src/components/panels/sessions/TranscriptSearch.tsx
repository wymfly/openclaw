"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { HistoryMessage } from "@/stores/sessions";

interface TranscriptSearchProps {
  messages: HistoryMessage[];
  onHighlight: (indices: number[]) => void;
  onNavigate: (index: number) => void;
}

export function TranscriptSearch({ messages, onHighlight, onNavigate }: TranscriptSearchProps) {
  const t = useTranslations("sessions");
  const [query, setQuery] = useState("");
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setMatchIndices([]);
        setCurrentMatch(0);
        onHighlight([]);
        return;
      }
      const lower = q.toLowerCase();
      const indices = messages
        .map((msg, i) => (msg.content.toLowerCase().includes(lower) ? i : -1))
        .filter((i) => i !== -1);
      setMatchIndices(indices);
      setCurrentMatch(0);
      onHighlight(indices);
      if (indices.length > 0) {
        onNavigate(indices[0]);
      }
    },
    [messages, onHighlight, onNavigate],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const goNext = () => {
    if (matchIndices.length === 0) {
      return;
    }
    const next = (currentMatch + 1) % matchIndices.length;
    setCurrentMatch(next);
    onNavigate(matchIndices[next]);
  };

  const goPrev = () => {
    if (matchIndices.length === 0) {
      return;
    }
    const prev = (currentMatch - 1 + matchIndices.length) % matchIndices.length;
    setCurrentMatch(prev);
    onNavigate(matchIndices[prev]);
  };

  const clear = () => {
    setQuery("");
    setMatchIndices([]);
    setCurrentMatch(0);
    onHighlight([]);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] shrink-0">
      <Search size={14} className="text-[var(--muted-foreground)] shrink-0" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className={cn(
          "flex-1 min-w-0 text-sm bg-transparent outline-none",
          "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
        )}
      />
      {hasQuery && (
        <>
          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap">
            {matchIndices.length > 0
              ? t("searchCount", { current: currentMatch + 1, total: matchIndices.length })
              : t("searchNoResults")}
          </span>
          {matchIndices.length > 0 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] cursor-pointer"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] cursor-pointer"
              >
                <ChevronDown size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={clear}
            className="p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] cursor-pointer"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
