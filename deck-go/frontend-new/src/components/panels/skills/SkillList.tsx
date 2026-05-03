import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { SKILL_STATUS_FILTERS, type PanelState, type SkillStatusFilter } from "./skill-model";
import { SkillMetric } from "./SkillMetric";

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
    <article className="skills-panel__card">
      <div className="skills-panel__card-head">
        <div className="skills-panel__title-stack">
          <h2 className="skills-panel__title is-compact">{t("installedTitle")}</h2>
          <p className="skills-panel__description">{t("installedDescription")}</p>
        </div>
      </div>
      <div className="skills-panel__body">
        <div className="skills-panel__pill-row">
          <span className={`skills-panel__pill ${props.loadState === "ready" ? "is-good" : ""}`}>
            {t("title")} {loadStateLabel}
          </span>
          <span className="skills-panel__pill">
            {t("installedCount", { count: props.skills.length })}
          </span>
          <span className="skills-panel__pill">
            {t("needSetupCount", { count: props.setupCount })}
          </span>
        </div>
        <div className="skills-panel__metrics">
          <SkillMetric label={t("installed")} value={props.skills.length} />
          <SkillMetric label={t("ready")} value={props.readyCount} />
          <SkillMetric label={t("needsSetup")} value={props.setupCount} />
          <SkillMetric label={t("shown")} value={props.filteredSkills.length} />
        </div>
        <div className="skills-panel__actions">
          <input
            aria-label="installed skill search"
            className="skills-panel__input"
            value={props.skillSearchQuery}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder={t("searchInstalledPlaceholder")}
          />
          <select
            aria-label="installed skill status"
            className="skills-panel__input"
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
        <div className="skills-panel__actions">
          <button className="skills-panel__button" type="button" onClick={props.onRefresh}>
            {t("refreshSkills")}
          </button>
          <button
            className="skills-panel__button is-primary"
            type="button"
            onClick={() => props.onToggle(true)}
            disabled={
              !props.selectedSkill || props.actionState !== "idle" || props.selectedSkill.enabled
            }
          >
            {props.actionState === "updating" ? t("updating") : t("enable")}
          </button>
          <button
            className="skills-panel__button is-danger"
            type="button"
            onClick={() => props.onToggle(false)}
            disabled={
              !props.selectedSkill || props.actionState !== "idle" || !props.selectedSkill.enabled
            }
          >
            {props.actionState === "updating" ? t("updating") : t("disable")}
          </button>
        </div>
        {props.error ? <p className="skills-panel__note is-danger">{props.error}</p> : null}
        {props.skills.length === 0 ? (
          <p className="skills-panel__note">{t("noSkillsReported")}</p>
        ) : props.filteredSkills.length === 0 ? (
          <p className="skills-panel__note">{t("noInstalledSkillsMatch")}</p>
        ) : (
          <ul className="skills-panel__list" aria-label="installed skill list">
            {props.filteredSkills.map((skill) => (
              <li key={skill.key}>
                <button
                  type="button"
                  className={`skills-panel__row ${
                    props.selectedSkill?.key === skill.key ? "is-selected" : ""
                  }`}
                  onClick={() => props.onSelect(skill.key)}
                >
                  <div className="skills-panel__row-head">
                    <strong>
                      {skill.emoji ? `${skill.emoji} ` : ""}
                      {skill.name}
                    </strong>
                    <span
                      className={`skills-panel__pill ${
                        skill.status === "ready"
                          ? "is-good"
                          : skill.status === "needs-setup"
                            ? "is-warn"
                            : ""
                      }`}
                    >
                      {skill.status}
                    </span>
                  </div>
                  <div className="skills-panel__meta">
                    {t("key")}: {skill.key} | {t("source")}: {skill.source} | {t("status")}:{" "}
                    {skill.status}
                  </div>
                  <div className="skills-panel__meta">
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
