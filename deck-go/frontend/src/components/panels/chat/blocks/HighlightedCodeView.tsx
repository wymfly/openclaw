import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import "@/design-system/atoms/code.css";

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
    <div className="ds-code-view" data-language={language} data-tool-result-view="read">
      <div className="ds-code-view__bar">
        <span>{language}</span>
        <button type="button" onClick={() => void handleCopy()}>
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="ds-code-view__scroll">
        {lines.map((line, index) => (
          <div className="ds-code-view__line" key={`${index}-${line}`}>
            <span className="ds-code-view__ln">{index + 1}</span>
            <code>{line || "\u00A0"}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
