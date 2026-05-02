import { useDeckUI } from "../../deck-ui/ui-store";
import { useCapabilities } from "../../hooks/useCapabilities";
import { useTranslations } from "../../i18n/provider";

export function FirstRunBanner() {
  const t = useTranslations("runtimeMode");
  const { capabilities } = useCapabilities();
  const { setActivePanel } = useDeckUI();

  if (!capabilities || capabilities.mode !== "remote" || capabilities.configured) {
    return null;
  }

  return (
    <section
      className="deckgo-panel-hero-strip deck-ui-first-run-banner"
      data-testid="first-run-banner"
    >
      <div>
        <p className="deckgo-kicker">{t("remoteFirstRun")}</p>
        <strong>{t("firstRunTitle")}</strong>
        <p className="deckgo-note">{t("firstRunDescription")}</p>
      </div>
      <button
        className="deckgo-button is-primary"
        type="button"
        data-testid="first-run-banner-cta"
        onClick={() => setActivePanel("settings")}
      >
        {t("firstRunCta")}
      </button>
    </section>
  );
}
