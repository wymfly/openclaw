import { useTranslations } from "next-intl";
import { useState } from "react";
import { Block } from "@/design-system/atoms/Block";
import { Button } from "@/design-system/atoms/Button";
import { formatParamSummary } from "@/lib/format-utils";
import { ToolParamView } from "./ToolParamView";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
  defaultOpen?: boolean;
  /** When rendered inside a `ToolPair`, suppress own border (shared with sibling result). */
  paired?: boolean;
}

export function ToolUseCard({ name, input, defaultOpen, paired }: ToolUseCardProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const summary = formatParamSummary(input);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const label = (
    <>
      <span className="ds-tool-icon" aria-hidden="true">
        #
      </span>
      <span>
        {t("toolCall")}: <code>{name}</code>
        {summary ? ` (${summary})` : ""}
      </span>
    </>
  );

  return (
    <Block
      label={label}
      collapsible
      defaultOpen={defaultOpen}
      tone="accent"
      className={
        paired
          ? "ds-tool-use-card ds-tool-use-card--paired ds-block--tool-use"
          : "ds-tool-use-card ds-block--tool-use"
      }
    >
      <div className="ds-tool-use-card__actions">
        <Button
          variant="ghost"
          size="sm"
          title={copied ? t("copied") : t("copyJson")}
          onClick={() => void handleCopy()}
        >
          {copied ? t("copied") : t("copyJson")}
        </Button>
      </div>
      <ToolParamView input={input} />
    </Block>
  );
}
