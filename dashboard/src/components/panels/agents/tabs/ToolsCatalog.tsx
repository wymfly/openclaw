"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useDeckAgentsStore,
  type ToolCatalogEntry,
  type ToolCatalogGroup,
} from "@/stores/deck-agents";

type OverrideState = "default" | "allow" | "deny";

interface ToolsCatalogProps {
  agentId: string;
  toolsAllow: string[];
  toolsDeny: string[];
  onOverrideChange: (allow: string[], deny: string[]) => void;
}

function getOverrideState(toolId: string, allow: string[], deny: string[]): OverrideState {
  if (deny.includes(toolId)) {
    return "deny";
  }
  if (allow.includes(toolId)) {
    return "allow";
  }
  return "default";
}

export function ToolsCatalog({
  agentId,
  toolsAllow,
  toolsDeny,
  onOverrideChange,
}: ToolsCatalogProps) {
  const t = useTranslations("agentDetail.config");
  const { toolsCatalog, toolsCatalogLoading, fetchToolsCatalog } = useDeckAgentsStore();
  const [open, setOpen] = useState(false);
  const [loadedForAgent, setLoadedForAgent] = useState<string | null>(null);

  // Reset loaded state when agent changes
  useEffect(() => {
    setLoadedForAgent(null);
  }, [agentId]);

  useEffect(() => {
    if (open && loadedForAgent !== agentId) {
      void fetchToolsCatalog(agentId);
      setLoadedForAgent(agentId);
    }
  }, [open, loadedForAgent, agentId, fetchToolsCatalog]);

  const handleOverrideChange = useCallback(
    (toolId: string, newState: OverrideState) => {
      let nextAllow = toolsAllow.filter((id) => id !== toolId);
      let nextDeny = toolsDeny.filter((id) => id !== toolId);
      if (newState === "allow") {
        nextAllow = [...nextAllow, toolId];
      }
      if (newState === "deny") {
        nextDeny = [...nextDeny, toolId];
      }
      onOverrideChange(nextAllow, nextDeny);
    },
    [toolsAllow, toolsDeny, onOverrideChange],
  );

  // Graceful degradation: don't render if catalog failed to load
  if (loadedForAgent === agentId && !toolsCatalogLoading && !toolsCatalog) {
    return null;
  }

  return (
    <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-xs font-medium text-[var(--foreground)] flex-1 text-left">
              {t("toolsCatalog")}
            </span>
            {toolsCatalog && (
              <Badge
                variant="outline"
                className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] mr-1"
              >
                {toolsCatalog.groups.reduce((sum, g) => sum + g.tools.length, 0)}
              </Badge>
            )}
            <ChevronRight
              size={14}
              className={cn(
                "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                open && "rotate-90",
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-3">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {t("toolsCatalogDescription")}
            </p>
            {toolsCatalogLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("toolsCatalogLoading")}
                </span>
              </div>
            ) : toolsCatalog ? (
              toolsCatalog.groups.map((group) => (
                <ToolGroup
                  key={group.id}
                  group={group}
                  toolsAllow={toolsAllow}
                  toolsDeny={toolsDeny}
                  onOverrideChange={handleOverrideChange}
                />
              ))
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">{t("toolsCatalogEmpty")}</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ToolGroup
// ---------------------------------------------------------------------------

function ToolGroup({
  group,
  toolsAllow,
  toolsDeny,
  onOverrideChange,
}: {
  group: ToolCatalogGroup;
  toolsAllow: string[];
  toolsDeny: string[];
  onOverrideChange: (toolId: string, state: OverrideState) => void;
}) {
  const [groupOpen, setGroupOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)] cursor-pointer"
        onClick={() => setGroupOpen(!groupOpen)}
      >
        <ChevronRight
          size={12}
          className={cn(
            "text-[var(--muted-foreground)] transition-transform",
            groupOpen && "rotate-90",
          )}
        />
        {group.label}
        <Badge
          variant="outline"
          className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
        >
          {group.source}
        </Badge>
        <span className="text-[10px] text-[var(--muted-foreground)]">({group.tools.length})</span>
      </button>
      {groupOpen && (
        <div className="ml-4 mt-1 space-y-0.5">
          {group.tools.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              overrideState={getOverrideState(tool.id, toolsAllow, toolsDeny)}
              onOverrideChange={onOverrideChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolRow — single tool with 3-state override selector
// ---------------------------------------------------------------------------

const OVERRIDE_OPTIONS: OverrideState[] = ["default", "allow", "deny"];

function ToolRow({
  tool,
  overrideState,
  onOverrideChange,
}: {
  tool: ToolCatalogEntry;
  overrideState: OverrideState;
  onOverrideChange: (toolId: string, state: OverrideState) => void;
}) {
  const t = useTranslations("agentDetail.config");
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--accent)] transition-colors">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-[var(--foreground)] font-mono truncate block">
          {tool.label}
        </span>
        {tool.defaultProfiles.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {tool.defaultProfiles.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className="text-[8px] border-[var(--border)] text-[var(--muted-foreground)] px-1 py-0"
              >
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <select
        value={overrideState}
        onChange={(e) => onOverrideChange(tool.id, e.target.value as OverrideState)}
        className={cn(
          "rounded border border-[var(--border)] bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]",
          overrideState === "deny" && "text-[var(--destructive)]",
          overrideState === "allow" && "text-[var(--success)]",
          overrideState === "default" && "text-[var(--muted-foreground)]",
        )}
      >
        {OVERRIDE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(`tool${opt.charAt(0).toUpperCase() + opt.slice(1)}` as "toolDefault")}
          </option>
        ))}
      </select>
    </div>
  );
}
