"use client";

interface UnknownBlockCardProps {
  rawType: string;
  summary: Record<string, unknown>;
}

export function UnknownBlockCard({ rawType, summary }: UnknownBlockCardProps) {
  return (
    <details className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <summary className="px-2.5 py-1.5 cursor-pointer select-none bg-[var(--muted)] text-[var(--muted-foreground)]">
        Unsupported block: {rawType}
      </summary>
      <pre className="px-2.5 py-2 whitespace-pre-wrap bg-[var(--background)] text-[var(--foreground)]">
        {JSON.stringify(summary, null, 2)}
      </pre>
    </details>
  );
}
