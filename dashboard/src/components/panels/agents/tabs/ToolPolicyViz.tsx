"use client";

import { Check, ChevronDown, ChevronRight, Minus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolPolicyPreview } from "@/stores/deck-agents";

interface ToolPolicyVizProps {
  preview: ToolPolicyPreview;
}

const EFFECT_STYLES = {
  allow: {
    badge: "border-[var(--success)]/30 text-[var(--success)] bg-[var(--success-muted)]",
    icon: <Check size={10} className="text-[var(--success)]" />,
  },
  deny: {
    badge: "border-[var(--danger)]/30 text-[var(--danger)] bg-[var(--danger-muted)]",
    icon: <X size={10} className="text-[var(--danger)]" />,
  },
  passthrough: {
    badge: "border-[var(--border)] text-[var(--text-secondary)]",
    icon: <Minus size={10} className="text-[var(--text-secondary)]" />,
  },
} as const;

function decisionColor(decision: "allow" | "deny" | "no-opinion"): string {
  if (decision === "allow") {
    return "text-[var(--success)]";
  }
  if (decision === "deny") {
    return "text-[var(--danger)]";
  }
  return "text-[var(--text-secondary)]";
}

function decisionIcon(decision: "allow" | "deny" | "no-opinion") {
  if (decision === "allow") {
    return <Check size={10} className="text-[var(--success)] shrink-0" />;
  }
  if (decision === "deny") {
    return <X size={10} className="text-[var(--danger)] shrink-0" />;
  }
  return <Minus size={10} className="text-[var(--text-secondary)] shrink-0" />;
}

export function ToolPolicyViz({ preview }: ToolPolicyVizProps) {
  const t = useTranslations("context");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const filteredTools = preview.tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Pipeline Layers */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
          {t("policyLayers")}
        </p>
        <div className="space-y-1">
          {preview.layers.map((layer, i) => {
            const effect = layer.effect in EFFECT_STYLES ? layer.effect : "passthrough";
            const styles = EFFECT_STYLES[effect];
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                {/* Index */}
                <span className="text-[10px] font-mono text-[var(--text-secondary)] w-4 shrink-0 text-right">
                  {i + 1}
                </span>
                {/* Effect icon */}
                <span className="shrink-0">{styles.icon}</span>
                {/* Label */}
                <span className="text-xs font-mono text-[var(--text-primary)] flex-1 truncate">
                  {layer.label}
                </span>
                {/* Rule count */}
                {layer.ruleCount > 0 && (
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono shrink-0">
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
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
            "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
            "border border-[var(--border)] rounded",
            "focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]",
            "placeholder:text-[var(--text-secondary)]",
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
                  className="w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors text-left"
                >
                  {/* Allow/deny icon */}
                  {tool.allowed ? (
                    <Check size={12} className="text-[var(--success)] shrink-0" />
                  ) : (
                    <X size={12} className="text-[var(--danger)] shrink-0" />
                  )}
                  {/* Tool name */}
                  <span className="text-xs font-mono text-[var(--text-primary)] flex-1 truncate">
                    {tool.name}
                  </span>
                  {/* Decisive layer */}
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[120px] shrink-0">
                    {tool.decisiveLayer}
                  </span>
                  {/* Expand chevron */}
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-[var(--text-secondary)] shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-[var(--text-secondary)] shrink-0" />
                  )}
                </button>

                {/* Trace expansion */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-subtle)] px-3 py-2 space-y-1 bg-[var(--bg-secondary)]">
                    {tool.trace.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {decisionIcon(entry.decision)}
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
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
    </div>
  );
}
