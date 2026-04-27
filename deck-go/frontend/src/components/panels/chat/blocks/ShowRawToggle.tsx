import { useTranslations } from "next-intl";

export function ShowRawToggle({ isRaw, onToggle }: { isRaw: boolean; onToggle: () => void }) {
  const t = useTranslations("chat");

  return (
    <button
      aria-pressed={isRaw}
      className="deck-ui-tool-control deck-ui-raw-toggle"
      type="button"
      onClick={onToggle}
    >
      <span aria-hidden="true" className="deck-ui-raw-toggle-icon" />
      {isRaw ? t("showFormatted") : t("showRaw")}
    </button>
  );
}
