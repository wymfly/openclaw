import type { DeckGoContextWeightReport } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { contextWeightSummary, formatChars, formatTimestamp } from "./usage-format";

type ContextPressureProps = {
  contextWeight: DeckGoContextWeightReport | null;
  hasContextWeight: boolean;
  loading: boolean;
};

export function ContextPressure({
  contextWeight,
  hasContextWeight,
  loading,
}: ContextPressureProps) {
  const t = useTranslations("usage");
  const contextSummary = contextWeight ? contextWeightSummary(contextWeight) : null;

  return (
    <>
      <p className="deckgo-surface-label">{t("contextWeight")}</p>
      {loading && !hasContextWeight ? (
        <p className="deckgo-note deck-ui-usage-empty">{t("loadingContextWeight")}</p>
      ) : !contextWeight || !contextSummary ? (
        <p className="deckgo-note deck-ui-usage-empty">{t("noContextWeight")}</p>
      ) : (
        <>
          <div className="deckgo-grid deckgo-grid-3 deck-ui-usage-stats">
            <ShellStat label={t("contextTotal")} value={formatChars(contextSummary.total)} />
            <ShellStat label={t("source")} value={contextWeight.source} />
            <ShellStat label={t("generated")} value={formatTimestamp(contextWeight.generatedAt)} />
          </div>
          <ul className="deckgo-shell-list deck-ui-usage-list">
            <li>
              <div className="deckgo-selectable-card deck-ui-usage-row">
                <strong>{t("systemPrompt")}</strong>
                <div className="deckgo-meta deck-ui-usage-meta">
                  {t("contextSystemDetail", {
                    chars: formatChars(contextSummary.system),
                    project: formatChars(contextWeight.systemPrompt.projectContextChars),
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="deckgo-selectable-card deck-ui-usage-row">
                <strong>{t("toolsLower")}</strong>
                <div className="deckgo-meta deck-ui-usage-meta">
                  {t("contextEntryDetail", {
                    chars: formatChars(contextSummary.tools),
                    count: contextWeight.tools.entries.length,
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="deckgo-selectable-card deck-ui-usage-row">
                <strong>{t("skillsLower")}</strong>
                <div className="deckgo-meta deck-ui-usage-meta">
                  {t("contextEntryDetail", {
                    chars: formatChars(contextSummary.skills),
                    count: contextWeight.skills.entries.length,
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="deckgo-selectable-card deck-ui-usage-row">
                <strong>{t("filesLower")}</strong>
                <div className="deckgo-meta deck-ui-usage-meta">
                  {t("contextEntryDetail", {
                    chars: formatChars(contextSummary.files),
                    count: contextWeight.injectedWorkspaceFiles.length,
                  })}
                </div>
              </div>
            </li>
          </ul>
        </>
      )}
    </>
  );
}
