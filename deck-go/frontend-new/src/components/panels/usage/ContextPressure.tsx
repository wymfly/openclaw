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
      <p className="usage-panel__label">{t("contextWeight")}</p>
      {loading && !hasContextWeight ? (
        <p className="usage-panel__empty deck-ui-usage-empty">{t("loadingContextWeight")}</p>
      ) : !contextWeight || !contextSummary ? (
        <p className="usage-panel__empty deck-ui-usage-empty">{t("noContextWeight")}</p>
      ) : (
        <>
          <div className="usage-panel__mini-metrics deck-ui-usage-stats">
            <ShellStat label={t("contextTotal")} value={formatChars(contextSummary.total)} />
            <ShellStat label={t("source")} value={contextWeight.source} />
            <ShellStat label={t("generated")} value={formatTimestamp(contextWeight.generatedAt)} />
          </div>
          <ul className="usage-panel__list deck-ui-usage-list">
            <li>
              <div className="usage-panel__row deck-ui-usage-row">
                <strong>{t("systemPrompt")}</strong>
                <div className="usage-panel__meta deck-ui-usage-meta">
                  {t("contextSystemDetail", {
                    chars: formatChars(contextSummary.system),
                    project: formatChars(contextWeight.systemPrompt.projectContextChars),
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="usage-panel__row deck-ui-usage-row">
                <strong>{t("toolsLower")}</strong>
                <div className="usage-panel__meta deck-ui-usage-meta">
                  {t("contextEntryDetail", {
                    chars: formatChars(contextSummary.tools),
                    count: contextWeight.tools.entries.length,
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="usage-panel__row deck-ui-usage-row">
                <strong>{t("skillsLower")}</strong>
                <div className="usage-panel__meta deck-ui-usage-meta">
                  {t("contextEntryDetail", {
                    chars: formatChars(contextSummary.skills),
                    count: contextWeight.skills.entries.length,
                  })}
                </div>
              </div>
            </li>
            <li>
              <div className="usage-panel__row deck-ui-usage-row">
                <strong>{t("filesLower")}</strong>
                <div className="usage-panel__meta deck-ui-usage-meta">
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
