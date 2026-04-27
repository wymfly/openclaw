import type { DeckGoApprovalPolicyDefaults } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export type ExecSecurity = NonNullable<DeckGoApprovalPolicyDefaults["security"]>;
export type ExecAsk = NonNullable<DeckGoApprovalPolicyDefaults["ask"]>;

export const SECURITY_OPTIONS: ExecSecurity[] = ["deny", "allowlist", "full"];
export const ASK_OPTIONS: ExecAsk[] = ["off", "on-miss", "always"];

export function isExecSecurity(value: unknown): value is ExecSecurity {
  return typeof value === "string" && SECURITY_OPTIONS.includes(value as ExecSecurity);
}

export function isExecAsk(value: unknown): value is ExecAsk {
  return typeof value === "string" && ASK_OPTIONS.includes(value as ExecAsk);
}

function setDefaultsSelectValue(
  defaults: DeckGoApprovalPolicyDefaults,
  key: "security" | "ask" | "askFallback",
  value: string,
) {
  const next = { ...defaults };
  if (!value) {
    delete next[key];
    return next;
  }
  if (key === "ask" && isExecAsk(value)) {
    next.ask = value;
  } else if ((key === "security" || key === "askFallback") && isExecSecurity(value)) {
    next[key] = value;
  }
  return next;
}

function setDefaultsAutoAllowSkills(defaults: DeckGoApprovalPolicyDefaults, checked: boolean) {
  const next = { ...defaults };
  if (checked) {
    next.autoAllowSkills = true;
  } else {
    delete next.autoAllowSkills;
  }
  return next;
}

export function PolicyDefaultsControls(props: {
  label: string;
  defaults: DeckGoApprovalPolicyDefaults;
  onChange: (defaults: DeckGoApprovalPolicyDefaults) => void;
}) {
  const t = useTranslations("approvals");

  return (
    <div className="deckgo-form-grid deck-ui-approvals-policy-grid">
      <label className="deckgo-form-row">
        <span>{t("security")}</span>
        <select
          aria-label={`${props.label} security`}
          className="deckgo-input deck-ui-approvals-input"
          value={props.defaults.security ?? ""}
          onChange={(event) =>
            props.onChange(setDefaultsSelectValue(props.defaults, "security", event.target.value))
          }
        >
          <option value="">{t("inherit")}</option>
          {SECURITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-form-row">
        <span>{t("ask")}</span>
        <select
          aria-label={`${props.label} ask`}
          className="deckgo-input deck-ui-approvals-input"
          value={props.defaults.ask ?? ""}
          onChange={(event) =>
            props.onChange(setDefaultsSelectValue(props.defaults, "ask", event.target.value))
          }
        >
          <option value="">{t("inherit")}</option>
          {ASK_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-form-row">
        <span>{t("askFallback")}</span>
        <select
          aria-label={`${props.label} ask fallback`}
          className="deckgo-input deck-ui-approvals-input"
          value={props.defaults.askFallback ?? ""}
          onChange={(event) =>
            props.onChange(
              setDefaultsSelectValue(props.defaults, "askFallback", event.target.value),
            )
          }
        >
          <option value="">{t("inherit")}</option>
          {SECURITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="deckgo-checkbox-row">
        <input
          aria-label={`${props.label} auto allow skills`}
          type="checkbox"
          checked={props.defaults.autoAllowSkills === true}
          onChange={(event) =>
            props.onChange(setDefaultsAutoAllowSkills(props.defaults, event.target.checked))
          }
        />
        <span>{t("autoAllowSkills")}</span>
      </label>
    </div>
  );
}
