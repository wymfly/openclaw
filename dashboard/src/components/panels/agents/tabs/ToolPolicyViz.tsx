"use client";

import { Check, ChevronDown, ChevronRight, Minus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore, type ToolPolicyPreview } from "@/stores/deck-agents";

interface ToolPolicyVizProps {
  preview: ToolPolicyPreview;
  agentId?: string;
}

const EFFECT_STYLES = {
  allow: {
    badge: "border-[var(--success)]/30 text-[var(--success)] bg-[var(--success-muted)]",
    icon: <Check size={10} className="text-[var(--success)]" />,
  },
  deny: {
    badge: "border-[var(--destructive)]/30 text-[var(--destructive)] bg-[var(--destructive-muted)]",
    icon: <X size={10} className="text-[var(--destructive)]" />,
  },
  passthrough: {
    badge: "border-[var(--border)] text-[var(--muted-foreground)]",
    icon: <Minus size={10} className="text-[var(--muted-foreground)]" />,
  },
} as const;

function decisionColor(decision: "allow" | "deny" | "no-opinion"): string {
  if (decision === "allow") {
    return "text-[var(--success)]";
  }
  if (decision === "deny") {
    return "text-[var(--destructive)]";
  }
  return "text-[var(--muted-foreground)]";
}

function decisionIcon(decision: "allow" | "deny" | "no-opinion") {
  if (decision === "allow") {
    return <Check size={10} className="text-[var(--success)] shrink-0" />;
  }
  if (decision === "deny") {
    return <X size={10} className="text-[var(--destructive)] shrink-0" />;
  }
  return <Minus size={10} className="text-[var(--muted-foreground)] shrink-0" />;
}

export function ToolPolicyViz({ preview, agentId }: ToolPolicyVizProps) {
  const t = useTranslations("context");
  const tAgents = useTranslations("agents");
  const { effectiveTools, effectiveToolsLoading, fetchEffectiveTools } = useDeckAgentsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      void fetchEffectiveTools(agentId);
    }
  }, [agentId, fetchEffectiveTools]);

  const filteredTools = preview.tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Pipeline Layers */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          {t("policyLayers")}
        </p>
        <div className="space-y-1">
          {preview.layers.map((layer, i) => {
            const effect = layer.effect in EFFECT_STYLES ? layer.effect : "passthrough";
            const styles = EFFECT_STYLES[effect];
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--card)]"
              >
                {/* Index */}
                <span className="text-[10px] font-mono text-[var(--muted-foreground)] w-4 shrink-0 text-right">
                  {i + 1}
                </span>
                {/* Effect icon */}
                <span className="shrink-0">{styles.icon}</span>
                {/* Label */}
                <span className="text-xs font-mono text-[var(--foreground)] flex-1 truncate">
                  {layer.label}
                </span>
                {/* Rule count */}
                {layer.ruleCount > 0 && (
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono shrink-0">
                    {layer.ruleCount}r
                  </span>
                )}
                {/* Effect badge */}
                <Badge
                  variant="outline"
                  className={cn("text-[10px] border shrink-0", styles.badge)}
                >
                  {effect}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool List */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          {t("toolList")}
        </p>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchTools")}
          className={cn(
            "w-full text-xs px-2 py-1.5 mb-2",
            "bg-[var(--card)] text-[var(--foreground)]",
            "border border-[var(--border)] rounded",
            "focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]",
            "placeholder:text-[var(--muted-foreground)]",
          )}
        />

        {/* Tool rows */}
        <div className="space-y-0.5">
          {filteredTools.map((tool) => {
            const isExpanded = expandedTool === tool.name;
            return (
              <div
                key={tool.name}
                className="border border-[var(--border-subtle)] rounded overflow-hidden"
              >
                {/* Tool row */}
                <button
                  type="button"
                  onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--card)] transition-colors text-left"
                >
                  {/* Allow/deny icon */}
                  {tool.allowed ? (
                    <Check size={12} className="text-[var(--success)] shrink-0" />
                  ) : (
                    <X size={12} className="text-[var(--destructive)] shrink-0" />
                  )}
                  {/* Tool name */}
                  <span className="text-xs font-mono text-[var(--foreground)] flex-1 truncate">
                    {tool.name}
                  </span>
                  {/* Decisive layer */}
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono truncate max-w-[120px] shrink-0">
                    {tool.decisiveLayer}
                  </span>
                  {/* Expand chevron */}
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-[var(--muted-foreground)] shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-[var(--muted-foreground)] shrink-0" />
                  )}
                </button>

                {/* Trace expansion */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)] px-3 py-2 space-y-1 bg-[var(--card)]">
                    {tool.trace.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {decisionIcon(entry.decision)}
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)] truncate">
                          {entry.layer}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-mono ml-auto shrink-0",
                            decisionColor(entry.decision),
                          )}
                        >
                          {entry.decision}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Effective Tools — post-policy-filter resolved tool list */}
      {(effectiveToolsLoading || effectiveTools.length > 0) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
            {tAgents("effectiveTools")}
          </p>
          {effectiveToolsLoading ? (
            <p className="text-xs text-[var(--muted-foreground)]">{t("loading")}</p>
          ) : (
            <div className="space-y-3">
              {effectiveTools.map((group) => (
                <div key={group.name} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{group.name}</div>
                  {group.tools.map((tool) => (
                    <div key={tool.id} className="flex items-center gap-2 text-xs pl-2">
                      <span className="font-mono text-[var(--foreground)] flex-1 truncate">
                        {tool.name}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: tool.allowed
                            ? "var(--success-muted)"
                            : "var(--destructive-muted)",
                          color: tool.allowed
                            ? "var(--success-muted-text)"
                            : "var(--destructive-muted-text)",
                        }}
                      >
                        {tool.allowed ? tAgents("toolAllowed") : tAgents("toolDenied")}
                      </span>
                      <span className="text-[var(--text-tertiary)] shrink-0">{tool.source}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
