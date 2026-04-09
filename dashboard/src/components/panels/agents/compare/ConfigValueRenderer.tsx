"use client";

interface ConfigValueRendererProps {
  value: unknown;
}

export function ConfigValueRenderer({ value }: ConfigValueRendererProps) {
  if (value === undefined || value === null) {
    return <span className="text-[10px] italic text-[var(--text-tertiary)]">null</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded"
        style={{
          backgroundColor: value ? "var(--success-muted)" : "var(--destructive-muted)",
          color: value ? "var(--success-muted-text)" : "var(--destructive-muted-text)",
        }}
      >
        {String(value)}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="text-[10px] font-mono" style={{ color: "var(--primary)" }}>
        {value}
      </span>
    );
  }

  if (typeof value === "string") {
    return (
      <span className="text-[10px] font-mono break-all" style={{ color: "var(--success)" }}>
        &quot;{value}&quot;
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[10px] font-mono text-[var(--text-tertiary)]">[]</span>;
    }
    return (
      <div className="space-y-0.5">
        {value.map((item, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="text-[9px] text-[var(--text-tertiary)] shrink-0">{i}:</span>
            <ConfigValueRenderer value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{"{}"}</span>;
    }
    return (
      <div className="pl-2 border-l space-y-0.5" style={{ borderColor: "var(--border-subtle)" }}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-1">
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">
              {k}:
            </span>
            <ConfigValueRenderer value={v} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className="text-[10px] font-mono text-[var(--foreground)]">{JSON.stringify(value)}</span>
  );
}
