import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  RotateCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  type IconComponent,
} from "@/deck-ui/icons";
import { IconButton } from "@/design-system/atoms/IconButton";
import "./chat-widgets.css";

export function MessageActions({ content, onRetry }: { content: string; onRetry?: () => void }) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="ds-message-actions deck-ui-message-actions"
      role="toolbar"
      aria-label={t("messageActions")}
    >
      <ActionButton
        icon={copied ? CheckIcon : CopyIcon}
        label={copied ? t("copied") : t("copy")}
        onClick={() => void handleCopy()}
      />
      {onRetry ? <ActionButton icon={RotateCcwIcon} label={t("retry")} onClick={onRetry} /> : null}
      <ActionButton
        icon={ThumbsUpIcon}
        label={t("thumbsUp")}
        pressed={reaction === "up"}
        onClick={() => setReaction((current) => (current === "up" ? null : "up"))}
      />
      <ActionButton
        icon={ThumbsDownIcon}
        label={t("thumbsDown")}
        pressed={reaction === "down"}
        onClick={() => setReaction((current) => (current === "down" ? null : "down"))}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  pressed,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton
      size="sm"
      className="deck-ui-message-action"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      <Icon />
    </IconButton>
  );
}
