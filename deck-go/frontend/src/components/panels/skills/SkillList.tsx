import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import { SKILL_STATUS_FILTERS, type PanelState, type SkillStatusFilter } from "./skill-model";

export function SkillList(props: {
  actionState: "idle" | "installing" | "updating";
  error: string;
  filteredSkills: DeckGoSkillEntry[];
  loadState: PanelState;
  readyCount: number;
  selectedSkill: DeckGoSkillEntry | null;
  setupCount: number;
  skillSearchQuery: string;
  skillStatusFilter: SkillStatusFilter;
  skills: DeckGoSkillEntry[];
  onRefresh: () => void;
  onSearchChange: (query: string) => void;
  onSelect: (skillKey: string) => void;
  onStatusFilterChange: (filter: SkillStatusFilter) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const statusLabel = (status: SkillStatusFilter) => t(`statusFilters.${status}`);
  const loadStateLabel = t(`loadStates.${props.loadState}`);

  return (
    <article className="deckgo-card is-float deck-ui-skills-card">
      <div className="deckgo-card-header">
        <h2 className="deckgo-card-title">{t("installedTitle")}</h2>
      </div>
      <p className="deckgo-card-subtitle">{t("installedDescription")}</p>
      <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
        <div className="deckgo-pill-row deck-ui-skills-status-row">
          <span
            className={`deckgo-pill ${props.loadState === "ready" ? "is-positive" : "is-muted"}`}
          >
            {t("title")} {loadStateLabel}
          </span>
          <span className="deckgo-pill">{t("installedCount", { count: props.skills.length })}</span>
          <span className="deckgo-pill">{t("needSetupCount", { count: props.setupCount })}</span>
        </div>
        <div className="deckgo-grid deckgo-grid-3 deck-ui-skills-stats">
          <ShellStat label={t("installed")} value={props.skills.length} />
          <ShellStat label={t("ready")} value={props.readyCount} />
          <ShellStat label={t("needsSetup")} value={props.setupCount} />
          <ShellStat label={t("shown")} value={props.filteredSkills.length} />
        </div>
        <div className="deckgo-actions deck-ui-skills-actions">
          <input
            aria-label="installed skill search"
            className="deckgo-input deck-ui-skills-input"
            value={props.skillSearchQuery}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder={t("searchInstalledPlaceholder")}
          />
          <select
            aria-label="installed skill status"
            className="deckgo-input deck-ui-skills-input"
            value={props.skillStatusFilter}
            onChange={(event) =>
              props.onStatusFilterChange(event.target.value as SkillStatusFilter)
            }
          >
            {SKILL_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="deckgo-actions deck-ui-skills-actions">
          <button
            className="deckgo-button deck-ui-skills-button"
            type="button"
            onClick={props.onRefresh}
          >
            {t("refreshSkills")}
          </button>
          <button
            className="deckgo-button is-primary deck-ui-skills-button"
            type="button"
            onClick={() => props.onToggle(true)}
            disabled={
              !props.selectedSkill || props.actionState !== "idle" || props.selectedSkill.enabled
            }
          >
            {props.actionState === "updating" ? t("updating") : t("enable")}
          </button>
          <button
            className="deckgo-button is-danger deck-ui-skills-button"
            type="button"
            onClick={() => props.onToggle(false)}
            disabled={
              !props.selectedSkill || props.actionState !== "idle" || !props.selectedSkill.enabled
            }
          >
            {props.actionState === "updating" ? t("updating") : t("disable")}
          </button>
        </div>
        {props.error ? <p className="deckgo-note deck-ui-skills-error">{props.error}</p> : null}
        {props.skills.length === 0 ? (
          <p className="deckgo-note deck-ui-skills-empty">{t("noSkillsReported")}</p>
        ) : props.filteredSkills.length === 0 ? (
          <p className="deckgo-note deck-ui-skills-empty">{t("noInstalledSkillsMatch")}</p>
        ) : (
          <ul className="deckgo-shell-list deck-ui-skills-list" aria-label="installed skill list">
            {props.filteredSkills.map((skill) => (
              <li key={skill.key}>
                <button
                  type="button"
                  className={`deckgo-selectable-card deck-ui-skills-row ${
                    props.selectedSkill?.key === skill.key ? "is-selected" : ""
                  }`}
                  onClick={() => props.onSelect(skill.key)}
                >
                  <strong>
                    {skill.emoji ? `${skill.emoji} ` : ""}
                    {skill.name}
                  </strong>
                  <div className="deckgo-meta">
                    {t("key")}: {skill.key} | {t("source")}: {skill.source} | {t("status")}:{" "}
                    {skill.status}
                  </div>
                  <div className="deckgo-meta">
                    {t("enabledLower")}: {skill.enabled ? t("yes") : t("no")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
