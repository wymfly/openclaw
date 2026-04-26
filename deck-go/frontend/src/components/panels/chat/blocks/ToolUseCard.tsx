import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatParamSummary } from "@/lib/format-utils";
import { ToolParamView } from "./ToolParamView";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
  defaultOpen?: boolean;
}

export function ToolUseCard({ name, input, defaultOpen }: ToolUseCardProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const summary = formatParamSummary(input);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details className="deck-ui-tool-use-card" open={defaultOpen}>
      <summary className="deck-ui-tool-use-summary">
        <span className="deck-ui-tool-icon" aria-hidden="true">
          #
        </span>
        <span className="deck-ui-tool-label">{t("toolCall")}: </span>
        <code>{name}</code>
        {summary ? <span className="deck-ui-tool-summary"> ({summary})</span> : null}
      </summary>
      <div className="deck-ui-tool-use-body">
        <div className="deck-ui-tool-use-actions">
          <button
            className="deck-ui-tool-control"
            type="button"
            title={copied ? t("copied") : t("copyJson")}
            onClick={() => void handleCopy()}
          >
            {copied ? t("copied") : t("copyJson")}
          </button>
        </div>
        <ToolParamView input={input} />
      </div>
    </details>
  );
}
