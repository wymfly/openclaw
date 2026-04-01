"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModelsStore } from "@/stores/models";

interface FallbackChainEditorProps {
  fallbacks: string[];
  onChange: (fallbacks: string[]) => void;
}

export function FallbackChainEditor({ fallbacks, onChange }: FallbackChainEditorProps) {
  const t = useTranslations("agentDetail.config");
  const { usableModels: models, fetchUsableModels } = useModelsStore();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (models.length === 0) {
      void fetchUsableModels();
    }
  }, [models.length, fetchUsableModels]);

  useEffect(() => {
    if (adding) {
      inputRef.current?.focus();
    }
  }, [adding]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!adding) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setAdding(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adding]);

  const availableModels = useMemo(() => {
    const existing = new Set(fallbacks);
    const q = search.toLowerCase();
    return models
      .filter(
        (m) =>
          !existing.has(m.id) &&
          (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [models, fallbacks, search]);

  const handleAdd = useCallback(
    (modelId: string) => {
      onChange([...fallbacks, modelId]);
      setAdding(false);
      setSearch("");
    },
    [fallbacks, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(fallbacks.filter((_, i) => i !== index));
    },
    [fallbacks, onChange],
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= fallbacks.length) {
        return;
      }
      const next = [...fallbacks];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      onChange(next);
    },
    [fallbacks, onChange],
  );

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[var(--muted-foreground)]">
        {t("fallbackModels")}
      </span>
      <p className="text-[10px] text-[var(--muted-foreground)]">{t("fallbackDescription")}</p>

      {fallbacks.length === 0 ? (
        <p className="text-[10px] text-[var(--muted-foreground)] italic py-2">{t("noFallback")}</p>
      ) : (
        <div className="space-y-1">
          {fallbacks.map((modelId, i) => (
            <div
              key={`${modelId}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)]"
            >
              <Badge
                variant="outline"
                className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)] shrink-0"
              >
                #{i + 1}
              </Badge>
              <span className="text-xs font-mono text-[var(--foreground)] flex-1 min-w-0 truncate">
                {modelId}
              </span>
              <button
                type="button"
                onClick={() => handleMove(i, -1)}
                disabled={i === 0}
                className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title={t("moveFallbackUp")}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleMove(i, 1)}
                disabled={i === fallbacks.length - 1}
                className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title={t("moveFallbackDown")}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="p-0.5 rounded hover:bg-[var(--destructive-muted)] text-[var(--destructive)] cursor-pointer"
                title={t("removeFallback")}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add fallback */}
      <div className="relative">
        {adding ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("addFallback")}
              className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {availableModels.length > 0 && (
              <div
                ref={listRef}
                className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-popover shadow-md"
              >
                {availableModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left px-2 py-1 text-xs cursor-pointer hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAdd(m.id);
                    }}
                  >
                    <span className="text-foreground">{m.name}</span>
                    <span className="ml-1 text-muted-foreground text-[10px]">{m.id}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-7 text-xs gap-1 cursor-pointer"
          >
            <Plus size={12} />
            {t("addFallback")}
          </Button>
        )}
      </div>
    </div>
  );
}
