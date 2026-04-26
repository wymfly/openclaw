import { useTranslations } from "next-intl";
import { formatTokenCount } from "@/lib/format-utils";

export function CompactionNotice({
  tokensBefore,
  tokensAfter,
  timestamp,
}: {
  tokensBefore?: number;
  tokensAfter?: number;
  timestamp: number;
}) {
  const t = useTranslations("chat");
  return (
    <div className="deck-ui-compaction-notice">
      <span className="deck-ui-compaction-icon" aria-hidden="true">
        cmp
      </span>
      <span className="deck-ui-compaction-label">{t("compacted")}</span>
      {tokensBefore != null && tokensAfter != null ? (
        <span className="deck-ui-compaction-counts">
          {formatTokenCount(tokensBefore)} → {formatTokenCount(tokensAfter)}
        </span>
      ) : null}
      <span className="deck-ui-compaction-time">{new Date(timestamp).toLocaleTimeString()}</span>
    </div>
  );
}
