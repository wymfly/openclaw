import { useTranslations } from "../../../i18n/provider";

export const USAGE_RANGE_SHORTCUTS = [
  { days: "1", labelKey: "today" },
  { days: "7", labelKey: "7dShort" },
  { days: "14", labelKey: "14dShort" },
  { days: "30", labelKey: "30dShort" },
];

type DateRangePickerProps = {
  days: string;
  onDaysChange: (days: string) => void;
  onRefresh: (days: string) => void;
};

export function DateRangePicker({ days, onDaysChange, onRefresh }: DateRangePickerProps) {
  const t = useTranslations("usage");

  return (
    <div className="deckgo-surface-tile deck-ui-usage-surface">
      <p className="deckgo-surface-label">{t("refreshUsageRange")}</p>
      <div
        className="deckgo-actions deck-ui-usage-actions"
        role="group"
        aria-label={t("rangeShortcuts")}
      >
        {USAGE_RANGE_SHORTCUTS.map((shortcut) => (
          <button
            className={`deckgo-button deckgo-button-compact deck-ui-usage-button ${
              days === shortcut.days ? "is-primary" : ""
            }`}
            data-usage-range={shortcut.days}
            key={shortcut.days}
            type="button"
            onClick={() => {
              onDaysChange(shortcut.days);
              onRefresh(shortcut.days);
            }}
          >
            {t(shortcut.labelKey)}
          </button>
        ))}
      </div>
      <div className="deckgo-actions deck-ui-usage-controls">
        <input
          aria-label={t("days")}
          className="deckgo-input deck-ui-usage-input"
          value={days}
          onChange={(event) => onDaysChange(event.target.value)}
          placeholder={t("days")}
        />
        <button
          className="deckgo-button deck-ui-usage-button"
          type="button"
          onClick={() => onRefresh(days)}
        >
          {t("refreshUsage")}
        </button>
      </div>
    </div>
  );
}
