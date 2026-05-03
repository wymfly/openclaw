import type { DeckGoUsageProviderStatus, DeckGoUsageProviderWindow } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { formatReset } from "./usage-format";

type ProviderQuotaPanelProps = {
  hottestWindow: { provider: string; window: DeckGoUsageProviderWindow } | null;
  providers: DeckGoUsageProviderStatus[];
  selectedProvider: DeckGoUsageProviderStatus | null;
  onSelectProvider: (providerId: string) => void;
};

export function ProviderQuotaPanel({
  hottestWindow,
  onSelectProvider,
  providers,
  selectedProvider,
}: ProviderQuotaPanelProps) {
  const t = useTranslations("usage");

  return (
    <article className="usage-panel__card usage-panel__provider deck-ui-usage-card">
      <div>
        <p className="usage-panel__label">{t("providerQuotas")}</p>
        <h3 className="usage-panel__card-title">{t("panel.providerTitle")}</h3>
        <p className="usage-panel__description">{t("providerQuotasDescription")}</p>
      </div>
      <div className="usage-panel__body deck-ui-usage-body">
        {hottestWindow ? (
          <div className="usage-panel__hero deck-ui-usage-hero">
            <div>
              <p className="usage-panel__label">{t("highestPressureWindow")}</p>
              <strong>{hottestWindow.provider}</strong>
              <p className="usage-panel__note">{hottestWindow.window.label}</p>
            </div>
            <div className="usage-panel__pill-row deck-ui-usage-status-row">
              <span className="usage-panel__pill">
                {t("usedPercent", { percent: hottestWindow.window.usedPercent })}
              </span>
              <span className="usage-panel__pill">
                {t("resetsIn", { duration: formatReset(hottestWindow.window.resetAt) })}
              </span>
            </div>
          </div>
        ) : null}
        {providers.length === 0 ? (
          <p className="usage-panel__empty deck-ui-usage-empty">{t("noProviderUsage")}</p>
        ) : (
          <>
            <ul className="usage-panel__list deck-ui-usage-list">
              {providers.map((provider) => (
                <li key={provider.provider}>
                  <button
                    type="button"
                    className={`usage-panel__row deck-ui-usage-row ${selectedProvider?.provider === provider.provider ? "is-selected" : ""}`}
                    onClick={() => onSelectProvider(provider.provider)}
                  >
                    <strong>{provider.displayName || provider.provider}</strong>
                    <div className="usage-panel__meta deck-ui-usage-meta">
                      {t("providerPlanWindows", {
                        count: provider.windows.length,
                        plan: provider.plan || t("na"),
                      })}
                    </div>
                    {provider.error ? (
                      <div className="usage-panel__meta deck-ui-usage-meta">{provider.error}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {selectedProvider ? (
              <>
                <div className="usage-panel__mini-metrics deck-ui-usage-stats">
                  <ShellStat label={t("provider")} value={selectedProvider.provider} />
                  <ShellStat label={t("windows")} value={selectedProvider.windows.length} />
                </div>
                <ul className="usage-panel__list deck-ui-usage-list">
                  {selectedProvider.windows.map((window) => (
                    <li key={`${selectedProvider.provider}-${window.label}`}>
                      <div className="usage-panel__row deck-ui-usage-row">
                        <strong>{window.label}</strong>
                        <div className="usage-panel__meta deck-ui-usage-meta">
                          {t("usedPercent", { percent: window.usedPercent })}
                        </div>
                        <div className="usage-panel__meta deck-ui-usage-meta">
                          {t("resetsIn", { duration: formatReset(window.resetAt) })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <JsonDetails title={t("providerPayload")} payload={selectedProvider} />
              </>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
