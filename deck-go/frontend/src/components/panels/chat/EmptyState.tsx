import { useTranslations } from "next-intl";

export function EmptyState({ onSelectPrompt }: { onSelectPrompt?: (text: string) => void }) {
  const t = useTranslations("chat");
  const suggestions = ["suggestCreative", "suggestAnalyze", "suggestExplain"];
  const transcriptLabel =
    typeof t.has === "function" && t.has("transcriptLabel") ? t("transcriptLabel") : "Transcript";

  return (
    <section className="deck-ui-empty-state">
      <p className="deck-ui-eyebrow">{transcriptLabel}</p>
      <h2>{t("emptyTitle")}</h2>
      <p>{t("emptyDescription")}</p>
      {onSelectPrompt ? (
        <div className="deck-ui-filter-row">
          {suggestions.map((key) => (
            <button
              className="deck-ui-suggestion-button"
              key={key}
              type="button"
              onClick={() => onSelectPrompt(t(key))}
            >
              {t(key)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
