"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

// ---------------------------------------------------------------------------
// ToolParamView — structured key-value renderer for tool_use parameters.
// ---------------------------------------------------------------------------

const TRUNCATE_THRESHOLD = 500;

/** Render a single value cell based on its type. */
function ValueCell({ value }: { value: unknown }) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="text-[var(--text-tertiary)] italic">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-[var(--accent)]">{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-[var(--accent)]">{String(value)}</span>;
  }

  if (typeof value === "string") {
    if (value.length > TRUNCATE_THRESHOLD && !expanded) {
      return (
        <span>
          <span className="whitespace-pre-wrap break-all">
            {value.slice(0, TRUNCATE_THRESHOLD)}
          </span>
          <span
            role="button"
            tabIndex={0}
            className="ml-1 text-[var(--accent)] cursor-pointer hover:underline"
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setExpanded(true);
              }
            }}
          >
            {t("paramShowFull")}
          </span>
        </span>
      );
    }
    if (value.length > TRUNCATE_THRESHOLD && expanded) {
      return (
        <span>
          <span className="whitespace-pre-wrap break-all">{value}</span>
          <span
            role="button"
            tabIndex={0}
            className="ml-1 text-[var(--accent)] cursor-pointer hover:underline"
            onClick={() => setExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setExpanded(false);
              }
            }}
          >
            {t("paramShowLess")}
          </span>
        </span>
      );
    }
    return <span className="whitespace-pre-wrap break-all">{value}</span>;
  }

  // Object or array — collapsible nested section
  if (typeof value === "object") {
    return <NestedSection value={value as Record<string, unknown> | unknown[]} />;
  }

  return <span>{JSON.stringify(value)}</span>;
}

/** Collapsible nested object/array with key count summary. */
function NestedSection({ value }: { value: Record<string, unknown> | unknown[] }) {
  const t = useTranslations("chat");
  const isArray = Array.isArray(value);
  const count = isArray ? value.length : Object.keys(value).length;

  return (
    <details className="inline">
      <summary className="cursor-pointer select-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        {t("paramKeys", { count })}
      </summary>
      <pre className="mt-1 p-1.5 rounded text-xs overflow-auto bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ToolParamView({ input }: { input: Record<string, unknown> }) {
  const t = useTranslations("chat");
  const entries = Object.entries(input);

  if (entries.length === 0) {
    return <p className="text-xs text-[var(--text-tertiary)] italic py-1">{t("paramNoParams")}</p>;
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 min-w-0">
          <span className="shrink-0 font-mono text-[var(--text-secondary)] select-none">
            {key}:
          </span>
          <span className="min-w-0 font-mono text-[var(--text-primary)]">
            <ValueCell value={value} />
          </span>
        </div>
      ))}
    </div>
  );
}
