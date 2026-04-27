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
    <div className="deckgo-surface-tile deck-ui-approvals-surface">
      <p className="deckgo-surface-label">{t("approvalPolicyEditor")}</p>
      {policy ? (
        <>
          <p className="deckgo-kicker">{t("globalDefaults")}</p>
          <PolicyDefaultsControls
            label="global"
            defaults={policy.defaults}
            onChange={(defaults) => props.onStructuredPolicyChange({ ...policy, defaults })}
          />

          <p className="deckgo-kicker deck-ui-approvals-section-title">{t("perAgent")}</p>
          {Object.entries(policy.agents).length > 0 ? (
            <div className="deckgo-shell-list deck-ui-approvals-agent-list">
              {Object.entries(policy.agents).map(([agentId, agentDefaults]) => (
                <div key={agentId} className="deckgo-selectable-card deck-ui-approvals-policy-card">
                  <div className="deckgo-card-header">
                    <strong>{agentId}</strong>
                    <button
                      className="deckgo-button deck-ui-approvals-button is-danger"
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
            <p className="deckgo-note">{t("noAgentOverrides")}</p>
          )}
          <div className="deckgo-actions deck-ui-approvals-actions">
            <input
              aria-label="new approval agent id"
              className="deckgo-input deck-ui-approvals-input"
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
              className="deckgo-button deck-ui-approvals-button"
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
        <p className="deckgo-note">{t("policyJsonInvalid")}</p>
      )}
      <textarea
        aria-label="approval policy json"
        className="deckgo-textarea deck-ui-approvals-textarea"
        value={props.policyDraft}
        onChange={(event) => props.onPolicyDraftChange(event.target.value)}
        rows={12}
      />
      <div className="deckgo-actions deck-ui-approvals-actions deck-ui-approvals-actions-offset">
        <button
          className="deckgo-button deck-ui-approvals-button is-primary"
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
