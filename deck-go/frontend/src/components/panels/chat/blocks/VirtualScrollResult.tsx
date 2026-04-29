import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const COLLAPSED_LINE_COUNT = 200;

export function VirtualScrollResult({ content }: { content: string }) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);
  const visibleLines = expanded ? lines : lines.slice(0, COLLAPSED_LINE_COUNT);

  return (
    <div className="ds-virtual-result deck-ui-virtual-result" data-tool-result-view="virtual">
      <div className="ds-virtual-result__head deck-ui-virtual-result-head">
        <span>
          {t("virtualLines", {
            start: lines.length > 0 ? 1 : 0,
            end: visibleLines.length,
            total: lines.length,
          })}
        </span>
        <button
          className="ds-tool-control deck-ui-tool-control"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t("virtualCollapse") : t("virtualExpand")}
        </button>
      </div>
      <pre>{visibleLines.join("\n")}</pre>
    </div>
  );
}
