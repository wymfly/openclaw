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
    <article className="deckgo-card is-float deck-ui-skills-card">
      <div className="deckgo-card-header">
        <h2 className="deckgo-card-title">ClawHub</h2>
      </div>
      <p className="deckgo-card-subtitle">{t("clawHubDescription")}</p>
      <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
        <div className="deckgo-actions deck-ui-skills-actions">
          <input
            aria-label="skill hub search"
            className="deckgo-input deck-ui-skills-input"
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
            className="deckgo-button is-primary deck-ui-skills-button"
            type="button"
            onClick={props.onSearch}
            disabled={props.hubState === "loading" || !props.hubQuery.trim()}
          >
            {props.hubState === "loading" ? t("searching") : t("searchHub")}
          </button>
          <button
            className="deckgo-button deck-ui-skills-button"
            type="button"
            onClick={props.onUpdateAll}
            disabled={props.hubActionState !== "idle"}
          >
            {props.hubActionState === "updating" ? t("updating") : t("updateAllClawHub")}
          </button>
        </div>
        {props.bins.length ? (
          <div className="deckgo-pill-row deck-ui-skills-status-row">
            {props.bins.map((bin) => (
              <button
                className={`deckgo-pill ${props.selectedBin === bin ? "is-positive" : ""}`}
                key={bin}
                type="button"
                onClick={() => props.onSelectBin(bin)}
              >
                {bin}
              </button>
            ))}
          </div>
        ) : null}
        {props.error ? <p className="deckgo-note deck-ui-skills-error">{props.error}</p> : null}
        {props.results.length ? (
          <ul className="deckgo-shell-list deck-ui-skills-list">
            {props.results.map((result) => (
              <li key={result.slug}>
                <button
                  type="button"
                  className="deckgo-selectable-card deck-ui-skills-row"
                  onClick={() => props.onLoadDetail(result.slug)}
                >
                  <strong>{result.displayName}</strong>
                  <div className="deckgo-meta">
                    {t("slug")}: {result.slug}
                    {result.version ? ` | ${t("version")}: ${result.version}` : ""}
                  </div>
                  {result.summary ? <div className="deckgo-meta">{result.summary}</div> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="deckgo-note deck-ui-skills-empty">{t("noClawHubResults")}</p>
        )}
      </div>
    </article>
  );
}
