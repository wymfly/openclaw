interface UnknownBlockCardProps {
  rawType: string;
  summary: Record<string, unknown>;
}

export function UnknownBlockCard({ rawType, summary }: UnknownBlockCardProps) {
  // Native `<details>` chosen over `Block` atom for the same reason as
  // ThinkingBlock — keep body content in DOM regardless of open state so
  // textContent / search assertions stay deterministic.
  return (
    <details className="ds-block ds-block--unknown ds-unknown-block deck-ui-unknown-block">
      <summary>Unsupported block: {rawType}</summary>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </details>
  );
}
