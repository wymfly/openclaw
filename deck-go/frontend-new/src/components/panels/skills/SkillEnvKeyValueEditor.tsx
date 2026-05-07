import { useMemo, useState } from "react";
import { useTranslations } from "../../../i18n/provider";

export type SkillEnvRow = {
  id: string;
  key: string;
  value: string;
};

const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function envRecordToRows(env?: Record<string, unknown>): SkillEnvRow[] {
  const rows = Object.entries(env ?? {}).map(([key, value], index) => ({
    id: `${key || "env"}-${index}`,
    key,
    value: String(value ?? ""),
  }));
  return rows.length ? rows : [{ id: "env-0", key: "", value: "" }];
}

export function rowsToEnvRecord(rows: SkillEnvRow[]) {
  return Object.fromEntries(
    rows
      .map((row) => [row.key.trim(), row.value] as const)
      .filter(([key]) => key.length > 0),
  );
}

export function envRowsHaveInvalidKeys(rows: SkillEnvRow[]) {
  return rows.some((row) => {
    const key = row.key.trim();
    return key.length > 0 && !ENV_KEY_PATTERN.test(key);
  });
}

export function SkillEnvKeyValueEditor(props: {
  rows: SkillEnvRow[];
  keyLabel: string;
  valueLabel: string;
  rawLabel: string;
  onRowsChange: (rows: SkillEnvRow[]) => void;
}) {
  const t = useTranslations("skills");
  const [rawOpen, setRawOpen] = useState(false);
  const [rawDraft, setRawDraft] = useState(() => JSON.stringify(rowsToEnvRecord(props.rows), null, 2));
  const hasInvalid = useMemo(() => envRowsHaveInvalidKeys(props.rows), [props.rows]);

  const updateRow = (id: string, patch: Partial<SkillEnvRow>) => {
    props.onRowsChange(props.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    props.onRowsChange([...props.rows, { id: `env-${Date.now()}`, key: "", value: "" }]);
  };

  const applyRaw = () => {
    try {
      const parsed = JSON.parse(rawDraft) as Record<string, unknown>;
      props.onRowsChange(envRecordToRows(parsed));
    } catch {
      // Keep the raw draft visible; validation remains local to the editor.
    }
  };

  return (
    <div className="skills-panel__env-editor">
      {props.rows.map((row, index) => (
        <div className="skills-panel__env-row" key={row.id}>
          <label>
            <span>{props.keyLabel}</span>
            <input
              className="skills-panel__input"
              aria-label={`${props.keyLabel} ${index + 1}`}
              value={row.key}
              onChange={(event) => updateRow(row.id, { key: event.target.value })}
            />
          </label>
          <label>
            <span>{props.valueLabel}</span>
            <input
              className="skills-panel__input"
              aria-label={`${props.valueLabel} ${index + 1}`}
              value={row.value}
              onChange={(event) => updateRow(row.id, { value: event.target.value })}
            />
          </label>
        </div>
      ))}
      {hasInvalid ? <p className="skills-panel__note is-danger">{t("envKeyPatternError")}</p> : null}
      <div className="skills-panel__modal-actions">
        <button className="skills-panel__button" type="button" onClick={addRow}>
          {t("addEnvRow")}
        </button>
        <button
          className="skills-panel__button"
          type="button"
          onClick={() => {
            setRawDraft(JSON.stringify(rowsToEnvRecord(props.rows), null, 2));
            setRawOpen((current) => !current);
          }}
        >
          {props.rawLabel}
        </button>
      </div>
      {rawOpen ? (
        <div className="skills-panel__raw-box">
          <textarea
            className="skills-panel__textarea"
            aria-label={props.rawLabel}
            value={rawDraft}
            onChange={(event) => setRawDraft(event.target.value)}
          />
          <button className="skills-panel__button" type="button" onClick={applyRaw}>
            {t("applyRawJson")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
