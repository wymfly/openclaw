import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/design-system/atoms/Badge";
import { Block } from "@/design-system/atoms/Block";
import { Button } from "@/design-system/atoms/Button";
import { IconArrowD, IconArrowR, IconCheck, IconCopy, IconTool } from "@/design-system/icons";
import { ToolParamView } from "./ToolParamView";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
  defaultOpen?: boolean;
  running?: boolean;
  /** When rendered inside a `ToolPair`, suppress own border (shared with sibling result). */
  paired?: boolean;
}

export function ToolUseCard({
  name,
  input,
  defaultOpen = false,
  running,
  paired,
}: ToolUseCardProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const summary = formatToolSummary(input);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const label = (
    <>
      {running ? (
        <span className="ds-tool-use-card__spinner" aria-hidden="true" />
      ) : (
        <IconTool className="ds-tool-use-card__icon" size={12} />
      )}
      <code className="ds-tool-use-card__name">{name}</code>
    </>
  );

  const headActions = (
    <>
      <Badge className="ds-tool-use-card__status" variant={running ? "running" : "ok"}>
        {running ? "running" : "ok"}
      </Badge>
      {open ? (
        <IconArrowD className="ds-tool-use-card__chevron" size={12} />
      ) : (
        <IconArrowR className="ds-tool-use-card__chevron" size={12} />
      )}
    </>
  );

  return (
    <Block
      label={label}
      summary={summary}
      headActions={headActions}
      collapsible
      open={open}
      onOpenChange={setOpen}
      tone="accent"
      running={running}
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
          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          {copied ? t("copied") : t("copyJson")}
        </Button>
      </div>
      <ToolParamView input={input} />
    </Block>
  );
}

function formatToolSummary(input: Record<string, unknown>): string {
  const command = input.command;
  if (typeof command === "string" && command.trim()) {
    return command.length > 96 ? `${command.slice(0, 96)}...` : command;
  }
  const path = input.path ?? input.filePath ?? input.file_path ?? input.filename ?? input.file;
  if (typeof path === "string" && path.trim()) {
    return path;
  }
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return "";
  }
  try {
    const serialized = JSON.stringify(input);
    return serialized.length > 96 ? `${serialized.slice(0, 96)}...` : serialized;
  } catch {
    return keys.slice(0, 3).join(", ");
  }
}
