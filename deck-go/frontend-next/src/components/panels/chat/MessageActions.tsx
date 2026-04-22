"use client";

import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface MessageActionsProps {
  /** The text content of the message (for copy). */
  content: string;
  /** Callback to retry (re-send the previous user message). */
  onRetry?: () => void;
}

export function MessageActions({ content, onRetry }: MessageActionsProps) {
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
      className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity"
      role="toolbar"
      aria-label={t("messageActions")}
    >
      <ActionButton
        icon={copied ? <Check size={13} /> : <Copy size={13} />}
        label={copied ? t("copied") : t("copy")}
        onClick={() => void handleCopy()}
      />
      {onRetry && (
        <ActionButton icon={<RefreshCw size={13} />} label={t("retry")} onClick={onRetry} />
      )}
      <ActionButton
        icon={<ThumbsUp size={13} />}
        label={t("thumbsUp")}
        onClick={() => setReaction((r) => (r === "up" ? null : "up"))}
        active={reaction === "up"}
      />
      <ActionButton
        icon={<ThumbsDown size={13} />}
        label={t("thumbsDown")}
        onClick={() => setReaction((r) => (r === "down" ? null : "down"))}
        active={reaction === "down"}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="p-1 rounded transition-colors"
      style={{
        color: active ? "var(--primary)" : "var(--muted-foreground)",
        backgroundColor: active ? "var(--primary-muted)" : "transparent",
      }}
    >
      {icon}
    </button>
  );
}
