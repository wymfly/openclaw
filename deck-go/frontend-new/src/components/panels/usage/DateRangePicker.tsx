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
    <div className="usage-panel__card usage-panel__range deck-ui-usage-surface">
      <div>
        <p className="usage-panel__label">{t("refreshUsageRange")}</p>
        <h3 className="usage-panel__card-title">{t("panel.rangeTitle")}</h3>
      </div>
      <div
        className="usage-panel__segments deck-ui-usage-actions"
        role="tablist"
        aria-label={t("rangeShortcuts")}
      >
        {USAGE_RANGE_SHORTCUTS.map((shortcut) => (
          <button
            aria-selected={days === shortcut.days}
            className={`usage-panel__button deck-ui-usage-button ${
              days === shortcut.days ? "is-primary" : ""
            }`}
            data-usage-range={shortcut.days}
            key={shortcut.days}
            role="tab"
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
      <div className="usage-panel__range-controls deck-ui-usage-controls">
        <input
          aria-label={t("days")}
          className="usage-panel__input deck-ui-usage-input"
          value={days}
          onChange={(event) => onDaysChange(event.target.value)}
          placeholder={t("days")}
        />
        <button
          className="usage-panel__button deck-ui-usage-button"
          type="button"
          onClick={() => onRefresh(days)}
        >
          {t("refreshUsage")}
        </button>
      </div>
    </div>
  );
}
