"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  useApprovalsStore,
  type ApprovalPolicy,
  type ApprovalPolicyDefaults,
  type ExecAsk,
  type ExecSecurity,
} from "@/stores/approvals";
import { PathAllowlist } from "./PathAllowlist";

const SECURITY_OPTIONS: ExecSecurity[] = ["deny", "allowlist", "full"];
const ASK_OPTIONS: ExecAsk[] = ["off", "on-miss", "always"];

interface PolicySelectProps {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (value: string) => void;
}

function PolicySelect({ label, value, options, onChange }: PolicySelectProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-medium w-28 shrink-0"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs rounded px-2 py-1 border flex-1"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          maxWidth: 180,
        }}
      >
        <option value="">--</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PolicyToggleProps {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

function PolicyToggle({ label, value, onChange }: PolicyToggleProps) {
  const tc = useTranslations("common");
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs font-medium w-28 shrink-0"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className="text-xs px-3 py-1 rounded border cursor-pointer"
        style={{
          borderColor: value ? "var(--status-connected)" : "var(--border)",
          color: value ? "var(--status-connected)" : "var(--text-secondary)",
          backgroundColor: value ? "var(--success-muted)" : "transparent",
        }}
      >
        {value ? tc("on") : tc("off")}
      </button>
    </div>
  );
}

/** Edit a single defaults block (security, ask, askFallback, autoAllowSkills). */
function DefaultsEditor({
  defaults,
  onChange,
}: {
  defaults: ApprovalPolicyDefaults;
  onChange: (d: ApprovalPolicyDefaults) => void;
}) {
  const t = useTranslations("approvals");

  const update = (key: keyof ApprovalPolicyDefaults, value: unknown) => {
    onChange({ ...defaults, [key]: value || undefined });
  };

  return (
    <div className="space-y-2">
      <PolicySelect
        label={t("security")}
        value={defaults.security}
        options={SECURITY_OPTIONS}
        onChange={(v) => update("security", v)}
      />
      <PolicySelect
        label={t("ask")}
        value={defaults.ask}
        options={ASK_OPTIONS}
        onChange={(v) => update("ask", v)}
      />
      <PolicySelect
        label={t("askFallback")}
        value={defaults.askFallback}
        options={SECURITY_OPTIONS}
        onChange={(v) => update("askFallback", v)}
      />
      <PolicyToggle
        label={t("autoAllowSkills")}
        value={defaults.autoAllowSkills}
        onChange={(v) => update("autoAllowSkills", v)}
      />
    </div>
  );
}

/**
 * PolicyEditor — 4-dimensional approval policy editor.
 *
 * Global defaults from ExecApprovalsFile.defaults.
 * Per-agent overrides from ExecApprovalsFile.agents.
 * Path allowlist from ExecApprovalsFile.allowlist.
 */
export function PolicyEditor() {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const policy = useApprovalsStore((s) => s.policy);
  const fetchPolicy = useApprovalsStore((s) => s.fetchPolicy);
  const updatePolicy = useApprovalsStore((s) => s.updatePolicy);

  // Local draft for editing
  const [draft, setDraft] = useState<ApprovalPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");

  // Sync draft from store
  useEffect(() => {
    if (policy && !draft) {
      setDraft(structuredClone(policy));
    }
  }, [policy, draft]);

  useEffect(() => {
    void fetchPolicy();
  }, [fetchPolicy]);

  const handleSave = useCallback(async () => {
    if (!draft) {
      return;
    }
    setSaving(true);
    setSaved(false);
    const ok = await updatePolicy(draft);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [draft, updatePolicy]);

  const handleAddAgent = () => {
    const id = newAgentId.trim();
    if (!id || !draft || id in draft.agents) {
      return;
    }
    setDraft({
      ...draft,
      agents: { ...draft.agents, [id]: {} },
    });
    setNewAgentId("");
  };

  const handleRemoveAgent = (agentId: string) => {
    if (!draft) {
      return;
    }
    const agents = { ...draft.agents };
    delete agents[agentId];
    setDraft({ ...draft, agents });
  };

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {tc("loading")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Global defaults */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {t("globalDefaults")}
        </h3>
        <DefaultsEditor
          defaults={draft.defaults}
          onChange={(defaults) => setDraft({ ...draft, defaults })}
        />
      </section>

      {/* Per-agent overrides */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {t("perAgent")}
        </h3>

        {Object.entries(draft.agents).map(([agentId, agentDefaults]) => (
          <div
            key={agentId}
            className="mb-4 p-3 rounded-lg border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {agentId}
              </span>
              <button
                onClick={() => handleRemoveAgent(agentId)}
                className="text-xs cursor-pointer"
                style={{ color: "var(--status-disconnected)" }}
              >
                {tc("delete")}
              </button>
            </div>
            <DefaultsEditor
              defaults={agentDefaults}
              onChange={(d) => setDraft({ ...draft, agents: { ...draft.agents, [agentId]: d } })}
            />
          </div>
        ))}

        {/* Add agent */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAgent()}
            placeholder={t("addAgentPlaceholder")}
            className="text-xs rounded px-2 py-1 border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              minWidth: 160,
            }}
          />
          <button
            onClick={handleAddAgent}
            disabled={!newAgentId.trim()}
            className="text-xs px-3 py-1 rounded border cursor-pointer"
            style={{
              borderColor: "var(--accent)",
              color: "var(--accent)",
              opacity: newAgentId.trim() ? 1 : 0.5,
            }}
          >
            {tc("create")}
          </button>
        </div>
      </section>

      {/* Path allowlist */}
      <section>
        <PathAllowlist
          paths={draft.allowlist}
          onChange={(allowlist) => setDraft({ ...draft, allowlist })}
        />
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded border cursor-pointer"
          style={{
            borderColor: "var(--accent)",
            backgroundColor: "var(--accent)",
            color: "var(--accent-fg)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? tc("loading") : tc("save")}
        </button>
        {saved && (
          <span className="text-xs" style={{ color: "var(--status-connected)" }}>
            {t("saved")}
          </span>
        )}
      </div>
    </div>
  );
}
