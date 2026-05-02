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
    <article className="deckgo-card is-float deck-ui-usage-card">
      <div className="deckgo-card-header">
        <h2 className="deckgo-card-title">{t("providerQuotas")}</h2>
      </div>
      <p className="deckgo-card-subtitle">{t("providerQuotasDescription")}</p>
      <div className="deckgo-card-body deckgo-dividerless deck-ui-usage-body">
        {hottestWindow ? (
          <div className="deckgo-panel-hero-strip deck-ui-usage-hero">
            <div>
              <p className="deckgo-kicker">{t("highestPressureWindow")}</p>
              <strong>{hottestWindow.provider}</strong>
              <p className="deckgo-note">{hottestWindow.window.label}</p>
            </div>
            <div className="deckgo-pill-row deck-ui-usage-status-row">
              <span className="deckgo-pill">
                {t("usedPercent", { percent: hottestWindow.window.usedPercent })}
              </span>
              <span className="deckgo-pill">
                {t("resetsIn", { duration: formatReset(hottestWindow.window.resetAt) })}
              </span>
            </div>
          </div>
        ) : null}
        {providers.length === 0 ? (
          <p className="deckgo-note deck-ui-usage-empty">{t("noProviderUsage")}</p>
        ) : (
          <>
            <ul className="deckgo-shell-list deck-ui-usage-list">
              {providers.map((provider) => (
                <li key={provider.provider}>
                  <button
                    type="button"
                    className={`deckgo-selectable-card deck-ui-usage-row ${selectedProvider?.provider === provider.provider ? "is-selected" : ""}`}
                    onClick={() => onSelectProvider(provider.provider)}
                  >
                    <strong>{provider.displayName || provider.provider}</strong>
                    <div className="deckgo-meta deck-ui-usage-meta">
                      {t("providerPlanWindows", {
                        count: provider.windows.length,
                        plan: provider.plan || t("na"),
                      })}
                    </div>
                    {provider.error ? (
                      <div className="deckgo-meta deck-ui-usage-meta">{provider.error}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {selectedProvider ? (
              <>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-usage-stats">
                  <ShellStat label={t("provider")} value={selectedProvider.provider} />
                  <ShellStat label={t("windows")} value={selectedProvider.windows.length} />
                </div>
                <ul className="deckgo-shell-list deck-ui-usage-list">
                  {selectedProvider.windows.map((window) => (
                    <li key={`${selectedProvider.provider}-${window.label}`}>
                      <div className="deckgo-selectable-card deck-ui-usage-row">
                        <strong>{window.label}</strong>
                        <div className="deckgo-meta deck-ui-usage-meta">
                          {t("usedPercent", { percent: window.usedPercent })}
                        </div>
                        <div className="deckgo-meta deck-ui-usage-meta">
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
