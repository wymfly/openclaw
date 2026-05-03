import type { DeckGoApprovalPolicy } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { PathAllowlist } from "./PathAllowlist";
import { PolicyDefaultsControls } from "./PolicyDefaultsControls";

export function PolicyEditor(props: {
  structuredPolicyDraft: DeckGoApprovalPolicy | null;
  policyDraft: string;
  newAgentId: string;
  newAllowlistPath: string;
  policySaveState: "idle" | "saving";
  onAddAgent: () => void;
  onAddAllowlistPath: () => void;
  onPolicyDraftChange: (value: string) => void;
  onNewAgentIdChange: (value: string) => void;
  onNewAllowlistPathChange: (value: string) => void;
  onRemoveAgent: (agentId: string) => void;
  onRemoveAllowlistPath: (path: string) => void;
  onSave: () => void;
  onStructuredPolicyChange: (policy: DeckGoApprovalPolicy) => void;
}) {
  const t = useTranslations("approvals");
  const policy = props.structuredPolicyDraft;

  return (
    <div className="approvals-panel__surface">
      <p className="approvals-panel__eyebrow">{t("approvalPolicyEditor")}</p>
      {policy ? (
        <>
          <p className="approvals-panel__eyebrow">{t("globalDefaults")}</p>
          <PolicyDefaultsControls
            label="global"
            defaults={policy.defaults}
            onChange={(defaults) => props.onStructuredPolicyChange({ ...policy, defaults })}
          />

          <p className="approvals-panel__eyebrow">{t("perAgent")}</p>
          {Object.entries(policy.agents).length > 0 ? (
            <div className="approvals-panel__agent-list">
              {Object.entries(policy.agents).map(([agentId, agentDefaults]) => (
                <div key={agentId} className="approvals-panel__policy-card">
                  <div className="approvals-panel__card-head">
                    <strong>{agentId}</strong>
                    <button
                      className="approvals-panel__button is-danger"
                      type="button"
                      onClick={() => props.onRemoveAgent(agentId)}
                    >
                      {t("removePath")}
                    </button>
                  </div>
                  <PolicyDefaultsControls
                    label={`agent ${agentId}`}
                    defaults={agentDefaults}
                    onChange={(defaults) =>
                      props.onStructuredPolicyChange({
                        ...policy,
                        agents: {
                          ...policy.agents,
                          [agentId]: defaults,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="approvals-panel__note">{t("noAgentOverrides")}</p>
          )}
          <div className="approvals-panel__actions">
            <input
              aria-label="new approval agent id"
              className="approvals-panel__input"
              value={props.newAgentId}
              onChange={(event) => props.onNewAgentIdChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onAddAgent();
                }
              }}
              placeholder="agent id"
            />
            <button
              className="approvals-panel__button"
              type="button"
              onClick={props.onAddAgent}
              disabled={!props.newAgentId.trim()}
            >
              {t("addAgent")}
            </button>
          </div>

          <PathAllowlist
            paths={policy.allowlist}
            newPath={props.newAllowlistPath}
            onAdd={props.onAddAllowlistPath}
            onNewPathChange={props.onNewAllowlistPathChange}
            onRemove={props.onRemoveAllowlistPath}
          />
        </>
      ) : (
        <p className="approvals-panel__note is-danger">{t("policyJsonInvalid")}</p>
      )}
      <textarea
        aria-label="approval policy json"
        className="approvals-panel__textarea"
        value={props.policyDraft}
        onChange={(event) => props.onPolicyDraftChange(event.target.value)}
        rows={12}
      />
      <div className="approvals-panel__actions">
        <button
          className="approvals-panel__button is-primary"
          type="button"
          onClick={props.onSave}
          disabled={props.policySaveState !== "idle" || !props.policyDraft.trim()}
        >
          {props.policySaveState === "saving" ? t("savingPolicy") : t("savePolicy")}
        </button>
      </div>
    </div>
  );
}
