import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export function HighlightedCodeView({
  content,
  extension,
}: {
  content: string;
  extension?: string;
}) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);
  const language = extension?.toLowerCase() || "text";

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="deck-ui-highlighted-code" data-language={language} data-tool-result-view="read">
      <div className="deck-ui-code-toolbar">
        <span>{language}</span>
        <button className="deck-ui-tool-control" type="button" onClick={() => void handleCopy()}>
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="deck-ui-code-scroll">
        {lines.map((line, index) => (
          <div className="deck-ui-code-line" key={`${index}-${line}`}>
            <span className="deck-ui-code-gutter">{index + 1}</span>
            <code>{line || "\u00A0"}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
