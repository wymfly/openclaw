import { useTranslations } from "next-intl";

export function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  // Native `<details>` keeps body content in DOM when collapsed (visually hidden
  // only). The Block atom unmounts the body — that breaks transcript-search and
  // textContent assertions, so we keep `<details>` here and apply ds-* classes
  // for visual parity.
  return (
    <details className="ds-thinking-block deck-ui-thinking-block">
      <summary>
        <span className="ds-tool-icon deck-ui-tool-icon" aria-hidden="true">
          ...
        </span>
        <span>{t("thinking")}</span>
      </summary>
      <pre>{text}</pre>
    </details>
  );
}
