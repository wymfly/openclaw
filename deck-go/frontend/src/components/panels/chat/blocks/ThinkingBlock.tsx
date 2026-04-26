import { useTranslations } from "next-intl";

export function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  return (
    <details className="deck-ui-thinking-block">
      <summary>
        <span className="deck-ui-tool-icon" aria-hidden="true">
          ...
        </span>
        <span>{t("thinking")}</span>
      </summary>
      <pre>{text}</pre>
    </details>
  );
}
