"use client";

import { Copy, Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deckFetch } from "@/lib/deck-client";
import { useDeckAgentsStore, type AgentDetail } from "@/stores/deck-agents";

// ---------------------------------------------------------------------------
// Template storage (localStorage V1)
// ---------------------------------------------------------------------------

const TEMPLATES_KEY = "openclaw-deck-agent-templates";

export interface AgentTemplate {
  name: string;
  createdAt: number;
  config: Record<string, unknown>;
}

function loadTemplates(): AgentTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as AgentTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: AgentTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// ---------------------------------------------------------------------------
// Clone Dialog
// ---------------------------------------------------------------------------

interface CloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAgent: AgentDetail;
}

export function CloneDialog({ open, onOpenChange, sourceAgent }: CloneDialogProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");
  const { patchAgentConfig } = useDeckAgentsStore();

  const [name, setName] = useState(`${sourceAgent.name} (Copy)`);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName(`${sourceAgent.name} (Copy)`);
    }
  }, [open, sourceAgent.name]);

  const handleClone = useCallback(async () => {
    if (!name.trim()) {
      return;
    }
    setCreating(true);
    try {
      // Create agent via API, then apply source config
      const res = await deckFetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data?.id ?? data?.agentId;
        if (newId && sourceAgent.model) {
          await patchAgentConfig(newId, "model", sourceAgent.model);
        }
        onOpenChange(false);
        // Refresh agents list
        const { useAgentsStore } = await import("@/stores/agents");
        await useAgentsStore.getState().fetchAgents();
      }
    } finally {
      setCreating(false);
    }
  }, [name, sourceAgent, patchAgentConfig, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cloneAgent")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("cloneName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleClone();
                }
              }}
              className="text-xs"
              autoFocus
            />
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">{t("cloneDescription")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleClone()} disabled={!name.trim() || creating}>
            <Copy size={12} className="mr-1" />
            {creating ? tc("creating") : t("clone")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Save as Template Dialog
// ---------------------------------------------------------------------------

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAgent: AgentDetail;
}

export function SaveTemplateDialog({ open, onOpenChange, sourceAgent }: SaveTemplateDialogProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");

  const [templateName, setTemplateName] = useState(sourceAgent.name ?? "");

  useEffect(() => {
    if (open) {
      setTemplateName(sourceAgent.name ?? "");
    }
  }, [open, sourceAgent.name]);

  const handleSave = useCallback(() => {
    if (!templateName.trim()) {
      return;
    }
    const templates = loadTemplates();
    const template: AgentTemplate = {
      name: templateName.trim(),
      createdAt: Date.now(),
      config: {
        model: sourceAgent.model,
        emoji: sourceAgent.emoji,
      },
    };
    templates.push(template);
    saveTemplates(templates);
    onOpenChange(false);
  }, [templateName, sourceAgent, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("saveAsTemplate")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("templateName")}</Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              className="text-xs"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!templateName.trim()}>
            <Download size={12} className="mr-1" />
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Template list for "Create from Template"
// ---------------------------------------------------------------------------

interface TemplateListProps {
  onSelect: (template: AgentTemplate) => void;
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const t = useTranslations("agentDetail");
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleDelete = useCallback((index: number) => {
    setTemplates((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveTemplates(next);
      return next;
    });
  }, []);

  if (templates.length === 0) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">{t("noTemplates")}</p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {templates.map((tmpl, i) => (
        <div
          key={`${tmpl.name}-${tmpl.createdAt}`}
          className="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer hover:bg-[var(--accent)] transition-colors"
          style={{ borderColor: "var(--border)" }}
          onClick={() => onSelect(tmpl)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSelect(tmpl);
            }
          }}
        >
          <div className="min-w-0">
            <span className="text-xs font-medium text-[var(--foreground)] truncate block">
              {tmpl.name}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {new Date(tmpl.createdAt).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(i);
            }}
            className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors shrink-0 ml-2"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
