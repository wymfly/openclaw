import { useTranslations } from "next-intl";
import { useState } from "react";

const TRUNCATE_THRESHOLD = 500;

export function ToolParamView({ input }: { input: Record<string, unknown> }) {
  const t = useTranslations("chat");
  const entries = Object.entries(input);

  if (entries.length === 0) {
    return <p className="deck-ui-tool-param-empty">{t("paramNoParams")}</p>;
  }

  return (
    <div className="deck-ui-tool-params">
      {entries.map(([key, value]) => (
        <div className="deck-ui-tool-param-row" key={key}>
          <span className="deck-ui-tool-param-key">{key}: </span>
          <ValueCell value={value} />
        </div>
      ))}
    </div>
  );
}

function ValueCell({ value }: { value: unknown }) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="deck-ui-tool-param-value is-null">null</span>;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="deck-ui-tool-param-value">{String(value)}</span>;
  }

  if (typeof value === "string") {
    if (value.length <= TRUNCATE_THRESHOLD) {
      return <span className="deck-ui-tool-param-value">{value}</span>;
    }

    return (
      <span className="deck-ui-tool-param-value">
        <span>{expanded ? value : value.slice(0, TRUNCATE_THRESHOLD)}</span>{" "}
        <button
          className="deck-ui-tool-inline-button"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t("paramShowLess") : t("paramShowFull")}
        </button>
      </span>
    );
  }

  if (typeof value === "object") {
    return (
      <span className="deck-ui-tool-param-value">
        <NestedSection value={value as Record<string, unknown> | unknown[]} />
      </span>
    );
  }

  return <span className="deck-ui-tool-param-value">{JSON.stringify(value)}</span>;
}

function NestedSection({ value }: { value: Record<string, unknown> | unknown[] }) {
  const t = useTranslations("chat");
  const count = Array.isArray(value) ? value.length : Object.keys(value).length;

  return (
    <details className="deck-ui-tool-param-nested">
      <summary>{t("paramKeys", { count })}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
