interface UnknownBlockCardProps {
  rawType: string;
  summary: Record<string, unknown>;
}

export function UnknownBlockCard({ rawType, summary }: UnknownBlockCardProps) {
  return (
    <details className="deck-ui-unknown-block">
      <summary>Unsupported block: {rawType}</summary>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
    </details>
  );
}
