"use client";

import { BookOpen, Brain, ChevronRight, FileText, RefreshCw, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import { FilesBrowser } from "./FilesBrowser";
import { ToolPolicyViz } from "./ToolPolicyViz";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";
const THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
];

interface ContextTabProps {
  agentId: string;
}

export function ContextTab({ agentId }: ContextTabProps) {
  const t = useTranslations("context");
  const {
    systemPromptPreview,
    toolPolicyPreview,
    fetchSystemPromptPreview,
    fetchToolPolicyPreview,
    patchAgentConfig,
  } = useDeckAgentsStore();

  const [promptLayersOpen, setPromptLayersOpen] = useState(false);
  const [bootstrapFilesOpen, setBootstrapFilesOpen] = useState(true);
  const [toolPolicyOpen, setToolPolicyOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("off");
  const [thinkingSaving, setThinkingSaving] = useState(false);

  // Fetch the current thinking level from config
  const fetchThinkingLevel = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        config?: { agents?: { defaults?: { thinkingDefault?: string } } };
      };
      const level = data.config?.agents?.defaults?.thinkingDefault;
      if (level && THINKING_LEVELS.includes(level as ThinkingLevel)) {
        setThinkingLevel(level as ThinkingLevel);
      }
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void fetchSystemPromptPreview(agentId);
    void fetchToolPolicyPreview(agentId);
    void fetchThinkingLevel();
  }, [agentId, fetchSystemPromptPreview, fetchToolPolicyPreview, fetchThinkingLevel]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchSystemPromptPreview(agentId),
      fetchToolPolicyPreview(agentId),
      fetchThinkingLevel(),
    ]);
    setRefreshing(false);
  };

  const handleThinkingChange = async (level: ThinkingLevel) => {
    if (level === thinkingLevel || thinkingSaving) {
      return;
    }
    setThinkingSaving(true);
    const ok = await patchAgentConfig(agentId, "agents.defaults.thinkingDefault", level);
    if (ok) {
      setThinkingLevel(level);
    }
    setThinkingSaving(false);
  };

  const layers = systemPromptPreview?.layers ?? [];
  const bootstrapFiles = systemPromptPreview?.bootstrapFiles ?? [];
  const toolPolicyTools = toolPolicyPreview?.tools ?? [];
  const allowedToolCount = toolPolicyTools.filter((t) => t.allowed).length;

  return (
    <div className="space-y-3">
      {/* Header row with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--foreground)]">{t("title")}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="h-7 px-2 gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
      </div>

      {/* Section 0: Thinking Level */}
      {/* Note: edits agents.defaults.thinkingDefault (global), not per-agent override */}
      <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-[var(--primary)] shrink-0" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              {t("thinkingTitle")}
            </span>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)]">{t("thinkingDescription")}</p>
          <div className="flex flex-wrap gap-1.5">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                disabled={thinkingSaving}
                onClick={() => void handleThinkingChange(level)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  level === thinkingLevel
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                )}
              >
                {t(`thinking${level.charAt(0).toUpperCase() + level.slice(1)}` as "thinkingOff")}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] italic">
            {t("thinkingGlobalNote")}
          </p>
        </div>
      </Card>

      {/* Section 1: Prompt Layers */}
      <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
        <Collapsible open={promptLayersOpen} onOpenChange={setPromptLayersOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <BookOpen size={14} className="text-[var(--primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--foreground)] flex-1 text-left">
                {t("promptLayers")}
              </span>
              {layers.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] mr-1"
                >
                  {layers.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                  promptLayersOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
              {layers.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">{t("loading")}</p>
              ) : (
                layers.map((layer, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-[var(--foreground)] truncate">
                        {layer.label}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                        {layer.source}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 font-mono">
                      {layer.charCount.toLocaleString()} ch
                    </span>
                  </div>
                ))
              )}
              {systemPromptPreview && (
                <div className="flex items-center justify-end pt-1">
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    {t("allowed")} {systemPromptPreview.totalChars.toLocaleString()} ch
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Section 2: Bootstrap Files */}
      <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
        <Collapsible open={bootstrapFilesOpen} onOpenChange={setBootstrapFilesOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <FileText size={14} className="text-[var(--primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--foreground)] flex-1 text-left">
                {t("filesBrowser")}
              </span>
              {bootstrapFiles.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] mr-1"
                >
                  {bootstrapFiles.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                  bootstrapFilesOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3">
              <FilesBrowser agentId={agentId} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Section 3: Tool Policy */}
      <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
        <Collapsible open={toolPolicyOpen} onOpenChange={setToolPolicyOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Shield size={14} className="text-[var(--primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--foreground)] flex-1 text-left">
                {t("toolPolicy")}
              </span>
              {toolPolicyTools.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] mr-1"
                >
                  {allowedToolCount}/{toolPolicyTools.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                  toolPolicyOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3">
              {toolPolicyPreview ? (
                <ToolPolicyViz preview={toolPolicyPreview} agentId={agentId} />
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">{t("loading")}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
