"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

interface AllowFromEditorProps {
  entries: string[];
  onChange: (entries: string[]) => void;
  formatHint?: string;
  normalize?: (raw: string) => string;
  validate?: (entry: string) => boolean;
  placeholder?: string;
}

function normalizeDefaultEntry(raw: string): string {
  return raw.trim();
}

function dedupePreserveOrder(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

export function AllowFromEditor({
  entries,
  onChange,
  formatHint,
  normalize = normalizeDefaultEntry,
  validate,
  placeholder,
}: AllowFromEditorProps) {
  const t = useTranslations("channels.access.allowFromEditor");
  const [input, setInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entryCountLabel = useMemo(() => t("count", { count: entries.length }), [entries.length, t]);

  const commitEntries = (rawValues: string[]) => {
    const normalized = dedupePreserveOrder(
      rawValues
        .map((value) => normalize(value))
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const invalid = validate ? normalized.find((entry) => !validate(entry)) : undefined;
    if (invalid) {
      setError(t("invalid", { entry: invalid }));
      return false;
    }
    setError(null);
    onChange(normalized);
    return true;
  };

  const handleAdd = () => {
    if (!input.trim()) {
      return;
    }
    if (commitEntries([...entries, input])) {
      setInput("");
    }
  };

  const handleBulkApply = () => {
    const parsed = bulkInput
      .split(/\r?\n/g)
      .flatMap((line) => line.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setBulkInput("");
      return;
    }
    if (commitEntries([...entries, ...parsed])) {
      setBulkInput("");
    }
  };

  const handleRemove = (entry: string) => {
    setError(null);
    onChange(entries.filter((candidate) => candidate !== entry));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {entryCountLabel}
        </p>
        {formatHint && (
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {formatHint}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder ?? t("placeholder")}
          className="flex-1 rounded-md border px-3 py-2 text-xs outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <Button size="sm" type="button" onClick={handleAdd}>
          {t("add")}
        </Button>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => {
            const isWildcard = entry === "*";
            return (
              <Badge
                key={entry}
                className="flex items-center gap-1 rounded-full border pr-1"
                style={{
                  borderColor: isWildcard ? "var(--primary)" : "var(--border)",
                  backgroundColor: isWildcard ? "var(--primary-muted)" : "var(--muted)",
                  color: isWildcard ? "var(--primary)" : "var(--foreground)",
                }}
              >
                <span className="max-w-[220px] truncate">{entry}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(entry)}
                  className="rounded-full p-0.5 transition-opacity hover:opacity-70"
                  aria-label={t("remove", { entry })}
                >
                  <X size={12} />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {t("empty")}
        </p>
      )}

      <details className="rounded-md border" style={{ borderColor: "var(--border)" }}>
        <summary
          className="cursor-pointer px-3 py-2 text-xs font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {t("bulkTitle")}
        </summary>
        <div className="space-y-2 border-t px-3 py-3" style={{ borderColor: "var(--border)" }}>
          <textarea
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={t("bulkPlaceholder")}
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-xs outline-none"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" type="button" variant="outline" onClick={handleBulkApply}>
              {t("bulkApply")}
            </Button>
          </div>
        </div>
      </details>

      {error && (
        <p className="text-[11px]" style={{ color: "var(--destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
