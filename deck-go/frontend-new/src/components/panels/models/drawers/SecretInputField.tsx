import type { DeckGoModelSecretInputStatus } from "@/api-types";
import { Input } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { envSecretRef, secretRefLabel, type SecretEditAction } from "../lib/models-selectors";

export interface SecretInputFieldProps {
  label: string;
  status: DeckGoModelSecretInputStatus | undefined;
  action: SecretEditAction;
  onChange: (next: SecretEditAction) => void;
  refPlaceholder?: string;
  description?: string;
  testId?: string;
}

export function SecretInputField({
  label,
  status,
  action,
  onChange,
  refPlaceholder,
  description,
  testId,
}: SecretInputFieldProps) {
  const t = useTranslations("models");
  const stored = status?.state ?? "missing";
  const setMode = (kind: SecretEditAction["kind"]) => {
    if (kind === "preserve") {
      onChange({ kind: "preserve" });
    } else if (kind === "clear") {
      onChange({ kind: "clear" });
    } else {
      onChange({ kind: "set-ref", ref: action.kind === "set-ref" ? action.ref : envSecretRef("") });
    }
  };

  return (
    <fieldset className="models-secret" data-testid={testId}>
      <legend>{label}</legend>
      <div className="models-secret-status">
        <span data-state={stored}>{t(`secret.${stored}`)}</span>
        {status?.state === "ref" ? (
          <code>{status.displayRef ?? secretRefLabel(status.ref)}</code>
        ) : null}
        {status?.state === "literal-redacted" ? (
          <span className="models-secret-redacted">
            {status.redactedHint ?? t("secret.literalHint")}
          </span>
        ) : null}
      </div>
      <div className="models-secret-modes" role="radiogroup" aria-label={label}>
        <label>
          <input
            type="radio"
            name={`${testId}-mode`}
            checked={action.kind === "preserve"}
            onChange={() => setMode("preserve")}
          />
          {t("secret.actions.preserve")}
        </label>
        <label>
          <input
            type="radio"
            name={`${testId}-mode`}
            checked={action.kind === "set-ref"}
            onChange={() => setMode("set-ref")}
          />
          {t("secret.actions.setRef")}
        </label>
        <label>
          <input
            type="radio"
            name={`${testId}-mode`}
            checked={action.kind === "clear"}
            onChange={() => setMode("clear")}
          />
          {t("secret.actions.clear")}
        </label>
      </div>
      {action.kind === "set-ref" ? (
        <div className="models-secret-ref">
          <Input
            value={action.ref.id}
            onChange={(event) =>
              onChange({
                kind: "set-ref",
                ref: { ...action.ref, id: event.target.value },
              })
            }
            placeholder={refPlaceholder ?? t("secret.refPlaceholder")}
            aria-label={t("secret.refLabel")}
          />
        </div>
      ) : null}
      {description ? <p className="models-secret-desc">{description}</p> : null}
    </fieldset>
  );
}
