"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

interface JsonTreeProps {
  content: string;
}

export function JsonTree({ content }: JsonTreeProps) {
  const t = useTranslations("chat");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return (
      <pre className="p-4 text-xs font-mono text-[var(--danger)] whitespace-pre-wrap">
        {t("artifactJsonInvalid")}
      </pre>
    );
  }

  return (
    <div className="p-3 overflow-auto flex-1 text-xs font-mono text-[var(--text-primary)]">
      <JsonNode value={parsed} depth={0} />
    </div>
  );
}

function JsonNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null) {
    return <span className="text-[var(--text-secondary)]">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-[var(--warning)]">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-[var(--accent)]">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-[var(--success)]">&quot;{value}&quot;</span>;
  }

  if (Array.isArray(value)) {
    return <CollapsibleNode bracket={["[", "]"]} entries={value} depth={depth} isArray />;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return <CollapsibleNode bracket={["{", "}"]} entries={entries} depth={depth} />;
  }

  return <span>{JSON.stringify(value)}</span>;
}

function CollapsibleNode({
  bracket,
  entries,
  depth,
  isArray,
}: {
  bracket: [string, string];
  entries: unknown[] | [string, unknown][];
  depth: number;
  isArray?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const indent = depth * 16;

  if (entries.length === 0) {
    return (
      <span>
        {bracket[0]}
        {bracket[1]}
      </span>
    );
  }

  return (
    <span>
      <button
        onClick={toggle}
        className="inline-flex items-center gap-0.5 hover:bg-[var(--bg-tertiary)] rounded cursor-pointer"
        type="button"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span>{bracket[0]}</span>
        {!open && (
          <span className="text-[var(--text-secondary)]">
            {isArray ? `${entries.length} items` : `${entries.length} keys`}
          </span>
        )}
        {!open && <span>{bracket[1]}</span>}
      </button>
      {open && (
        <>
          <div style={{ paddingLeft: indent + 16 }}>
            {(entries as unknown[]).map((entry, i) => {
              const isLast = i === entries.length - 1;
              if (isArray) {
                return (
                  <div key={i}>
                    <JsonNode value={entry} depth={depth + 1} />
                    {!isLast && <span className="text-[var(--text-secondary)]">,</span>}
                  </div>
                );
              }
              const [key, val] = entry as [string, unknown];
              return (
                <div key={key}>
                  <span className="text-[var(--text-primary)]">&quot;{key}&quot;</span>
                  <span className="text-[var(--text-secondary)]">: </span>
                  <JsonNode value={val} depth={depth + 1} />
                  {!isLast && <span className="text-[var(--text-secondary)]">,</span>}
                </div>
              );
            })}
          </div>
          <span>{bracket[1]}</span>
        </>
      )}
    </span>
  );
}
