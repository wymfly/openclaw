import { useMemo, useState } from "react";
import type { DeckGoSkillEntry, DeckGoSkillHubDetailResponse } from "../../../api";
import {
  envRecordToRows,
  envRowsHaveInvalidKeys,
  rowsToEnvRecord,
  SkillEnvKeyValueEditor,
  type SkillEnvRow,
} from "./SkillEnvKeyValueEditor";
import { useTranslations } from "../../../i18n/provider";

type WizardStep = 0 | 1 | 2 | 3 | 4;

export function InstallSkillWizard(props: {
  open: boolean;
  actionState: "idle" | "installing" | "updating";
  setupMessage: string;
  skills: DeckGoSkillEntry[];
  hubDetail: DeckGoSkillHubDetailResponse | null;
  onClose: () => void;
  onPreview: (slug: string) => Promise<void>;
  onInstall: (input: { slug: string; apiKey?: string; env?: Record<string, string> }) => Promise<void>;
}) {
  const t = useTranslations("skills");
  const [step, setStep] = useState<WizardStep>(0);
  const [slug, setSlug] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [envRows, setEnvRows] = useState<SkillEnvRow[]>(() => envRecordToRows());
  const env = useMemo(() => rowsToEnvRecord(envRows), [envRows]);
  const hasInvalidEnv = envRowsHaveInvalidKeys(envRows);
  const selectedDetail = props.hubDetail?.skill?.slug === slug ? props.hubDetail : null;
  const existingUsage =
    props.skills.find((skill) => skill.key === slug)?.agentUsage.count ??
    props.skills.find((skill) => skill.name === slug)?.agentUsage.count ??
    0;

  if (!props.open) {
    return null;
  }

  const canReview = slug.trim().length > 0 && !hasInvalidEnv;
  const masked = apiKey ? "••••" : t("none");

  return (
    <div className="skills-panel__modal-backdrop" role="presentation">
      <section className="skills-panel__modal is-wide" role="dialog" aria-modal="true" aria-label={t("installFromClawHub")}>
        <div className="skills-panel__modal-head">
          <div>
            <p className="skills-panel__eyebrow">L3</p>
            <h2>{t("installFromClawHub")}</h2>
          </div>
          <button className="skills-panel__button" type="button" onClick={props.onClose}>
            {t("close")}
          </button>
        </div>
        <ol className="skills-panel__wizard-steps">
          {["source", "slug", "apiKey", "env", "review"].map((item, index) => (
            <li className={step === index ? "is-active" : ""} key={item}>
              {t(`wizardSteps.${item}`)}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="skills-panel__surface">
            <h3>{t("wizardSourceTitle")}</h3>
            <p className="skills-panel__note">{t("wizardSourceBody")}</p>
            <div className="skills-panel__modal-actions">
              <button className="skills-panel__button is-primary" type="button" onClick={() => setStep(1)}>
                {t("nextSlug")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="skills-panel__surface">
            <label className="skills-panel__field">
              <span>{t("skillSlug")}</span>
              <input
                className="skills-panel__input"
                aria-label={t("skillSlug")}
                value={slug}
                onChange={(event) => setSlug(event.target.value.trim())}
              />
            </label>
            <div className="skills-panel__modal-actions">
              <button
                className="skills-panel__button"
                type="button"
                disabled={!slug}
                onClick={() => props.onPreview(slug)}
              >
                {t("previewSlug")}
              </button>
              <button
                className="skills-panel__button is-primary"
                type="button"
                disabled={!slug}
                onClick={() => setStep(2)}
              >
                {t("nextApiKey")}
              </button>
            </div>
            {selectedDetail?.latestVersion?.version ? (
              <p className="skills-panel__note">
                {t("latestVersionPreview")}: {selectedDetail.latestVersion.version}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="skills-panel__surface">
            <label className="skills-panel__field">
              <span>{t("optionalInstallApiKey")}</span>
              <input
                className="skills-panel__input"
                aria-label={t("optionalInstallApiKey")}
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <div className="skills-panel__modal-actions">
              <button className="skills-panel__button is-primary" type="button" onClick={() => setStep(3)}>
                {t("nextEnv")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="skills-panel__surface">
            <SkillEnvKeyValueEditor
              rows={envRows}
              keyLabel={t("wizardEnvKey")}
              valueLabel={t("wizardEnvValue")}
              rawLabel={t("showRawJson")}
              onRowsChange={setEnvRows}
            />
            <div className="skills-panel__modal-actions">
              <button
                className="skills-panel__button is-primary"
                type="button"
                disabled={!canReview}
                onClick={() => setStep(4)}
              >
                {t("reviewInstall")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="skills-panel__surface">
            <h3>{t("reviewAndConfirm")}</h3>
            <p className="skills-panel__note">{t("installTwoStepPlan")}</p>
            <dl className="skills-panel__definition-list">
              <dt>{t("slug")}</dt>
              <dd>{slug}</dd>
              <dt>{t("apiKey")}</dt>
              <dd>{masked}</dd>
              <dt>{t("envVars")}</dt>
              <dd>{Object.keys(env).length ? Object.keys(env).join(", ") : t("none")}</dd>
              <dt>{t("agentUsage")}</dt>
              <dd>{existingUsage}</dd>
            </dl>
            {props.setupMessage ? <p className="skills-panel__note is-danger">{props.setupMessage}</p> : null}
            <div className="skills-panel__modal-actions">
              <button className="skills-panel__button" type="button" onClick={() => setStep(3)}>
                {t("back")}
              </button>
              <button
                className="skills-panel__button is-primary"
                type="button"
                disabled={props.actionState !== "idle"}
                onClick={() =>
                  props.onInstall({
                    slug,
                    apiKey: apiKey || undefined,
                    env: Object.keys(env).length ? env : undefined,
                  })
                }
              >
                {t("confirmInstall")}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
