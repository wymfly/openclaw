"use client";

import { Plus, Trash2, Save, X as XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeckAgentsStore } from "@/stores/deck-agents";

interface ToolPolicyEditorProps {
  agentId: string;
  /** Current allow list from agent config */
  allowList: string[];
  /** Current deny list from agent config */
  denyList: string[];
  onClose: () => void;
}

/**
 * Interactive editor for agent tool allow/deny lists.
 * Uses patchAgentConfig to persist changes via config patch API.
 */
export function ToolPolicyEditor({
  agentId,
  allowList: initialAllow,
  denyList: initialDeny,
  onClose,
}: ToolPolicyEditorProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");
  const { effectiveTools, patchAgentConfig } = useDeckAgentsStore();

  const [allowList, setAllowList] = useState([...initialAllow]);
  const [denyList, setDenyList] = useState([...initialDeny]);
  const [allowInput, setAllowInput] = useState("");
  const [denyInput, setDenyInput] = useState("");
  const [saving, setSaving] = useState(false);

  // All known tool names for autocomplete
  const allToolNames = useMemo(() => {
    if (!effectiveTools) {
      return [];
    }
    return effectiveTools.map((t) => t.name).toSorted();
  }, [effectiveTools]);

  // Filter suggestions based on input
  const allowSuggestions = useMemo(() => {
    if (!allowInput.trim()) {
      return [];
    }
    const q = allowInput.toLowerCase();
    return allToolNames
      .filter((n) => n.toLowerCase().includes(q) && !allowList.includes(n))
      .slice(0, 5);
  }, [allowInput, allToolNames, allowList]);

  const denySuggestions = useMemo(() => {
    if (!denyInput.trim()) {
      return [];
    }
    const q = denyInput.toLowerCase();
    return allToolNames
      .filter((n) => n.toLowerCase().includes(q) && !denyList.includes(n))
      .slice(0, 5);
  }, [denyInput, allToolNames, denyList]);

  const isDirty =
    JSON.stringify(allowList) !== JSON.stringify(initialAllow) ||
    JSON.stringify(denyList) !== JSON.stringify(initialDeny);

  const addToAllow = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed && !allowList.includes(trimmed)) {
        setAllowList((prev) => [...prev, trimmed]);
      }
      setAllowInput("");
    },
    [allowList],
  );

  const addToDeny = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed && !denyList.includes(trimmed)) {
        setDenyList((prev) => [...prev, trimmed]);
      }
      setDenyInput("");
    },
    [denyList],
  );

  const removeFromAllow = useCallback((name: string) => {
    setAllowList((prev) => prev.filter((n) => n !== name));
  }, []);

  const removeFromDeny = useCallback((name: string) => {
    setDenyList((prev) => prev.filter((n) => n !== name));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const okAllow = await patchAgentConfig(agentId, "tools.allow", allowList);
      const okDeny = await patchAgentConfig(agentId, "tools.deny", denyList);
      if (okAllow && okDeny) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [agentId, allowList, denyList, patchAgentConfig, onClose]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("toolPolicyEditor")}</h3>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge className="text-[10px] border-0 bg-[var(--warning-muted)] text-[var(--warning-muted-text)]">
              {tc("unsaved")}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={!isDirty || saving}>
            <Save size={12} className="mr-1" />
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>

      {/* Allow list */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-[var(--success-muted-text)]">{t("allowList")}</h4>
        <div className="flex flex-wrap gap-1.5">
          {allowList.map((name) => (
            <Badge
              key={name}
              className="text-[10px] border-[var(--success)]/30 bg-[var(--success-muted)] text-[var(--success-muted-text)] gap-1"
            >
              {name}
              <button onClick={() => removeFromAllow(name)} className="hover:opacity-70">
                <Trash2 size={10} />
              </button>
            </Badge>
          ))}
          {allowList.length === 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">{t("noToolsInList")}</span>
          )}
        </div>
        <div className="relative">
          <Input
            value={allowInput}
            onChange={(e) => setAllowInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && allowInput.trim()) {
                addToAllow(allowInput);
              }
            }}
            placeholder={t("addToolPlaceholder")}
            className="text-xs"
          />
          {allowSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-md border bg-[var(--popover)] shadow-md">
              {allowSuggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => addToAllow(name)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent)] transition-colors"
                  style={{ color: "var(--foreground)" }}
                >
                  <Plus size={10} className="inline mr-1.5 text-[var(--success)]" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deny list */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-[var(--destructive-muted-text)]">
          {t("denyList")}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {denyList.map((name) => (
            <Badge
              key={name}
              className="text-[10px] border-[var(--destructive)]/30 bg-[var(--destructive-muted)] text-[var(--destructive-muted-text)] gap-1"
            >
              {name}
              <button onClick={() => removeFromDeny(name)} className="hover:opacity-70">
                <Trash2 size={10} />
              </button>
            </Badge>
          ))}
          {denyList.length === 0 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">{t("noToolsInList")}</span>
          )}
        </div>
        <div className="relative">
          <Input
            value={denyInput}
            onChange={(e) => setDenyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && denyInput.trim()) {
                addToDeny(denyInput);
              }
            }}
            placeholder={t("addToolPlaceholder")}
            className="text-xs"
          />
          {denySuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-md border bg-[var(--popover)] shadow-md">
              {denySuggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => addToDeny(name)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent)] transition-colors"
                  style={{ color: "var(--foreground)" }}
                >
                  <XIcon size={10} className="inline mr-1.5 text-[var(--destructive)]" />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
