import { useTranslations } from "next-intl";
import { useState } from "react";

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
    <div className="deck-ui-message-actions" role="toolbar" aria-label={t("messageActions")}>
      <button
        className="deck-ui-message-action"
        type="button"
        title={copied ? t("copied") : t("copy")}
        onClick={() => void handleCopy()}
      >
        {copied ? t("copied") : t("copy")}
      </button>
      {onRetry ? (
        <button
          className="deck-ui-message-action"
          type="button"
          title={t("retry")}
          onClick={onRetry}
        >
          {t("retry")}
        </button>
      ) : null}
      <button
        className="deck-ui-message-action"
        type="button"
        title={t("thumbsUp")}
        aria-pressed={reaction === "up"}
        onClick={() => setReaction((current) => (current === "up" ? null : "up"))}
      >
        {t("thumbsUp")}
      </button>
      <button
        className="deck-ui-message-action"
        type="button"
        title={t("thumbsDown")}
        aria-pressed={reaction === "down"}
        onClick={() => setReaction((current) => (current === "down" ? null : "down"))}
      >
        {t("thumbsDown")}
      </button>
    </div>
  );
}
