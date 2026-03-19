"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
      <Label className="text-xs w-28 shrink-0 text-[var(--text-secondary)]">{label}</Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger size="sm" className="max-w-[180px]">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">--</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface PolicyToggleProps {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

function PolicyToggle({ label, value, onChange }: PolicyToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-28 shrink-0 text-[var(--text-secondary)]">{label}</Label>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

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
    <div className="space-y-2.5">
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

export function PolicyEditor() {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const policy = useApprovalsStore((s) => s.policy);
  const fetchPolicy = useApprovalsStore((s) => s.fetchPolicy);
  const updatePolicy = useApprovalsStore((s) => s.updatePolicy);

  const [draft, setDraft] = useState<ApprovalPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");

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
        <span className="text-sm text-[var(--text-secondary)]">{tc("loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* Global defaults */}
      <section>
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-primary)]">
          {t("globalDefaults")}
        </h3>
        <DefaultsEditor
          defaults={draft.defaults}
          onChange={(defaults) => setDraft({ ...draft, defaults })}
        />
      </section>

      {/* Per-agent overrides */}
      <section>
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-primary)]">{t("perAgent")}</h3>

        {Object.entries(draft.agents).map(([agentId, agentDefaults]) => (
          <Card key={agentId} size="sm" className="mb-3">
            <CardContent>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold font-mono text-[var(--accent)]">
                  {agentId}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)] gap-1"
                  onClick={() => handleRemoveAgent(agentId)}
                >
                  <Trash2 size={12} />
                  {tc("delete")}
                </Button>
              </div>
              <DefaultsEditor
                defaults={agentDefaults}
                onChange={(d) => setDraft({ ...draft, agents: { ...draft.agents, [agentId]: d } })}
              />
            </CardContent>
          </Card>
        ))}

        {/* Add agent */}
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="text"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAgent()}
            placeholder={t("addAgentPlaceholder")}
            className="h-8 text-xs min-w-[160px] max-w-[240px]"
          />
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddAgent}
            disabled={!newAgentId.trim()}
            className="gap-1"
          >
            <Plus size={12} />
            {tc("create")}
          </Button>
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
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? tc("loading") : tc("save")}
        </Button>
        {saved && <span className="text-xs text-[var(--success-muted-text)]">{t("saved")}</span>}
      </div>
    </div>
  );
}
