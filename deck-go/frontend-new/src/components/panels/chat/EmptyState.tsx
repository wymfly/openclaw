import { useTranslations } from "next-intl";
import { Button } from "@/design-system/atoms/Button";
import "./chat-widgets.css";

export function EmptyState({ onSelectPrompt }: { onSelectPrompt?: (text: string) => void }) {
  const t = useTranslations("chat");
  const suggestions = ["suggestCreative", "suggestAnalyze", "suggestExplain"];
  const transcriptLabel =
    typeof t.has === "function" && t.has("transcriptLabel") ? t("transcriptLabel") : "Transcript";

  return (
    <section className="ds-empty-state">
      <p className="ds-empty-state__eyebrow">{transcriptLabel}</p>
      <h2 className="ds-empty-state__title">{t("emptyTitle")}</h2>
      <p className="ds-empty-state__description">{t("emptyDescription")}</p>
      {onSelectPrompt ? (
        <div className="ds-empty-state__suggestions">
          {suggestions.map((key) => (
            <Button key={key} variant="secondary" size="sm" onClick={() => onSelectPrompt(t(key))}>
              {t(key)}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
