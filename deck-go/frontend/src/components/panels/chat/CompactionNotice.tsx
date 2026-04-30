import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/design-system/atoms/Button";
import { formatTokenCount } from "@/lib/format-utils";
import { CompactionSummaryModal } from "./CompactionSummaryModal";
import "./chat-widgets.css";

export function CompactionNotice({
  tokensBefore,
  tokensAfter,
  timestamp,
  sessionKey,
}: {
  tokensBefore?: number;
  tokensAfter?: number;
  timestamp: number;
  sessionKey?: string | null;
}) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ds-compaction-notice">
        <span className="ds-compaction-notice__icon" aria-hidden="true">
          cmp
        </span>
        <span>{t("compacted")}</span>
        {tokensBefore != null && tokensAfter != null ? (
          <span className="ds-compaction-notice__counts">
            {formatTokenCount(tokensBefore)} → {formatTokenCount(tokensAfter)}
          </span>
        ) : null}
        {sessionKey ? (
          <Button
            size="sm"
            variant="ghost"
            className="ds-compaction-notice__view-summary"
            onClick={() => setOpen(true)}
          >
            {t("compactionViewSummary")}
          </Button>
        ) : null}
        <span className="ds-compaction-notice__time">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
      {sessionKey ? (
        <CompactionSummaryModal
          open={open}
          sessionKey={sessionKey}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
