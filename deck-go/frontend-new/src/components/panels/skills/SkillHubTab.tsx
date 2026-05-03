import type { DeckGoSkillHubSearchResult } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import type { PanelState } from "./skill-model";

export function SkillHubTab(props: {
  bins: string[];
  error: string;
  hubActionState: "idle" | "installing" | "updating";
  hubQuery: string;
  hubState: PanelState;
  results: DeckGoSkillHubSearchResult[];
  selectedBin: string;
  onHubQueryChange: (query: string) => void;
  onLoadDetail: (slug: string) => void;
  onSearch: () => void;
  onSelectBin: (bin: string) => void;
  onUpdateAll: () => void;
}) {
  const t = useTranslations("skills");

  return (
    <article className="skills-panel__card">
      <div className="skills-panel__card-head">
        <div className="skills-panel__title-stack">
          <h2 className="skills-panel__title is-compact">ClawHub</h2>
          <p className="skills-panel__description">{t("clawHubDescription")}</p>
        </div>
      </div>
      <div className="skills-panel__body">
        <div className="skills-panel__actions">
          <input
            aria-label="skill hub search"
            className="skills-panel__input"
            value={props.hubQuery}
            onChange={(event) => props.onHubQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                props.onSearch();
              }
            }}
            placeholder={t("hub.searchPlaceholder")}
          />
          <button
            className="skills-panel__button is-primary"
            type="button"
            onClick={props.onSearch}
            disabled={props.hubState === "loading" || !props.hubQuery.trim()}
          >
            {props.hubState === "loading" ? t("searching") : t("searchHub")}
          </button>
          <button
            className="skills-panel__button"
            type="button"
            onClick={props.onUpdateAll}
            disabled={props.hubActionState !== "idle"}
          >
            {props.hubActionState === "updating" ? t("updating") : t("updateAllClawHub")}
          </button>
        </div>
        {props.bins.length ? (
          <div className="skills-panel__pill-row">
            {props.bins.map((bin) => (
              <button
                className={`skills-panel__pill ${props.selectedBin === bin ? "is-good" : ""}`}
                key={bin}
                type="button"
                onClick={() => props.onSelectBin(bin)}
              >
                {bin}
              </button>
            ))}
          </div>
        ) : null}
        {props.error ? <p className="skills-panel__note is-danger">{props.error}</p> : null}
        {props.results.length ? (
          <ul className="skills-panel__list">
            {props.results.map((result) => (
              <li key={result.slug}>
                <button
                  type="button"
                  className="skills-panel__row"
                  onClick={() => props.onLoadDetail(result.slug)}
                >
                  <div className="skills-panel__row-head">
                    <strong>{result.displayName}</strong>
                    {result.version ? (
                      <span className="skills-panel__pill">
                        {t("version")}: {result.version}
                      </span>
                    ) : null}
                  </div>
                  <div className="skills-panel__meta">
                    {t("slug")}: {result.slug}
                  </div>
                  {result.summary ? (
                    <div className="skills-panel__meta">{result.summary}</div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="skills-panel__note">{t("noClawHubResults")}</p>
        )}
      </div>
    </article>
  );
}
