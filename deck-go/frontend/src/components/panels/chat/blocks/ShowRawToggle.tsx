import { useTranslations } from "next-intl";

export function ShowRawToggle({ isRaw, onToggle }: { isRaw: boolean; onToggle: () => void }) {
  const t = useTranslations("chat");

  return (
    <button
      aria-pressed={isRaw}
      className="ds-tool-control ds-raw-toggle deck-ui-tool-control deck-ui-raw-toggle"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span aria-hidden="true" className="ds-raw-toggle__icon deck-ui-raw-toggle-icon" />
      {isRaw ? t("showFormatted") : t("showRaw")}
    </button>
  );
}
