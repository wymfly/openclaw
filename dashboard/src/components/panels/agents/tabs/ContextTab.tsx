"use client";

import { BookOpen, ChevronRight, FileText, RefreshCw, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import { BootstrapFileEditor } from "./BootstrapFileEditor";
import { ToolPolicyViz } from "./ToolPolicyViz";

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
  } = useDeckAgentsStore();

  const [promptLayersOpen, setPromptLayersOpen] = useState(false);
  const [bootstrapFilesOpen, setBootstrapFilesOpen] = useState(true);
  const [toolPolicyOpen, setToolPolicyOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchSystemPromptPreview(agentId);
    void fetchToolPolicyPreview(agentId);
  }, [agentId, fetchSystemPromptPreview, fetchToolPolicyPreview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSystemPromptPreview(agentId), fetchToolPolicyPreview(agentId)]);
    setRefreshing(false);
  };

  const layers = systemPromptPreview?.layers ?? [];
  const bootstrapFiles = systemPromptPreview?.bootstrapFiles ?? [];
  const toolPolicyTools = toolPolicyPreview?.tools ?? [];
  const allowedToolCount = toolPolicyTools.filter((t) => t.allowed).length;

  return (
    <div className="space-y-3">
      {/* Header row with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">{t("title")}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="h-7 px-2 gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          {t("refresh")}
        </Button>
      </div>

      {/* Section 1: Prompt Layers */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border)] overflow-hidden">
        <Collapsible open={promptLayersOpen} onOpenChange={setPromptLayersOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <BookOpen size={14} className="text-[var(--accent)] shrink-0" />
              <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left">
                {t("promptLayers")}
              </span>
              {layers.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--text-secondary)] mr-1"
                >
                  {layers.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--text-secondary)] transition-transform duration-150 shrink-0",
                  promptLayersOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
              {layers.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">{t("loading")}</p>
              ) : (
                layers.map((layer, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {layer.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                        {layer.source}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] shrink-0 font-mono">
                      {layer.charCount.toLocaleString()} ch
                    </span>
                  </div>
                ))
              )}
              {systemPromptPreview && (
                <div className="flex items-center justify-end pt-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                    {t("allowed")} {systemPromptPreview.totalChars.toLocaleString()} ch
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Section 2: Bootstrap Files */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border)] overflow-hidden">
        <Collapsible open={bootstrapFilesOpen} onOpenChange={setBootstrapFilesOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <FileText size={14} className="text-[var(--accent)] shrink-0" />
              <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left">
                {t("bootstrapFiles")}
              </span>
              {bootstrapFiles.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--text-secondary)] mr-1"
                >
                  {bootstrapFiles.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--text-secondary)] transition-transform duration-150 shrink-0",
                  bootstrapFilesOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-1.5">
              {bootstrapFiles.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  {systemPromptPreview ? t("notCreated") : t("loading")}
                </p>
              ) : (
                systemPromptPreview?.bootstrapFiles && (
                  <BootstrapFileEditor
                    agentId={agentId}
                    files={systemPromptPreview.bootstrapFiles}
                  />
                )
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Section 3: Tool Policy */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border)] overflow-hidden">
        <Collapsible open={toolPolicyOpen} onOpenChange={setToolPolicyOpen}>
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Shield size={14} className="text-[var(--accent)] shrink-0" />
              <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left">
                {t("toolPolicy")}
              </span>
              {toolPolicyTools.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--text-secondary)] mr-1"
                >
                  {allowedToolCount}/{toolPolicyTools.length}
                </Badge>
              )}
              <ChevronRight
                size={14}
                className={cn(
                  "text-[var(--text-secondary)] transition-transform duration-150 shrink-0",
                  toolPolicyOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-[var(--border-subtle)] px-4 py-3">
              {toolPolicyPreview ? (
                <ToolPolicyViz preview={toolPolicyPreview} />
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">{t("loading")}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
