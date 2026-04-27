import { useTranslations } from "next-intl";
import { useState } from "react";

export function JsonTree({ content }: { content: string }) {
  const t = useTranslations("chat");
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return (
      <pre className="deck-ui-artifact-code" data-artifact-view="json-error">
        {t("artifactJsonInvalid")}
      </pre>
    );
  }

  return (
    <div className="deck-ui-artifact-json" data-artifact-view="json">
      <JsonNode depth={0} value={parsed} />
    </div>
  );
}

function JsonNode({ depth, value }: { depth: number; value: unknown }) {
  if (value === null) {
    return <span className="deck-ui-json-null">null</span>;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="deck-ui-json-primitive">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="deck-ui-json-string">&quot;{value}&quot;</span>;
  }
  if (Array.isArray(value)) {
    return <CollapsibleNode bracket={["[", "]"]} depth={depth} entries={value} isArray />;
  }
  if (typeof value === "object") {
    return (
      <CollapsibleNode
        bracket={["{", "}"]}
        depth={depth}
        entries={Object.entries(value as Record<string, unknown>)}
      />
    );
  }

  return <span>{JSON.stringify(value)}</span>;
}

function CollapsibleNode({
  bracket,
  depth,
  entries,
  isArray,
}: {
  bracket: [string, string];
  depth: number;
  entries: unknown[] | [string, unknown][];
  isArray?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const summary = isArray ? `[${entries.length} items]` : `{${entries.length} keys}`;

  if (entries.length === 0) {
    return (
      <span>
        {bracket[0]}
        {bracket[1]}
      </span>
    );
  }

  return (
    <span className="deck-ui-json-node">
      <button
        aria-expanded={open}
        className="deck-ui-json-toggle"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{open ? "v" : ">"}</span>
        <span className="deck-ui-json-summary">{summary}</span>
      </button>
      {open ? (
        <>
          <div className="deck-ui-json-children">
            {(entries as unknown[]).map((entry, index) => {
              const isLast = index === entries.length - 1;
              if (isArray) {
                return (
                  <div key={index}>
                    <JsonNode depth={depth + 1} value={entry} />
                    {!isLast ? <span>,</span> : null}
                  </div>
                );
              }
              const [key, childValue] = entry as [string, unknown];
              return (
                <div key={key}>
                  <span className="deck-ui-json-key">&quot;{key}&quot;</span>
                  <span>: </span>
                  <JsonNode depth={depth + 1} value={childValue} />
                  {!isLast ? <span>,</span> : null}
                </div>
              );
            })}
          </div>
          <span>{bracket[1]}</span>
        </>
      ) : null}
    </span>
  );
}
