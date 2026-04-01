"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { navigateToAgent } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useAgentsStore, type Agent } from "@/stores/agents";
import type { AgentSkills } from "@/stores/deck-agents";
import { useSkillsStore, type SkillEntry } from "@/stores/skills";

/**
 * Agent x Skill assignment matrix.
 * Rows = skills, columns = agents.
 * Cells: blue circle (all mode), green check (in whitelist), red X (not in whitelist).
 */
export function SkillMatrixTab() {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const skills = useSkillsStore((s) => s.skills);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);

  const [agentSkillsMap, setAgentSkillsMap] = useState<Map<string, AgentSkills>>(new Map());
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Load agents and skills
  useEffect(() => {
    void fetchAgents();
    void fetchSkills();
  }, [fetchAgents, fetchSkills]);

  // Load skills config for each agent
  const loadAllAgentSkills = useCallback(async () => {
    if (agents.length === 0) return;
    setLoading(true);
    const map = new Map<string, AgentSkills>();
    await Promise.all(
      agents.map(async (agent) => {
        try {
          const res = await fetch("/api/deck/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "skills.get", agentId: agent.id }),
          });
          if (res.ok) {
            const data = (await res.json()) as AgentSkills;
            map.set(agent.id, data);
          }
        } catch {
          // skip agent on error
        }
      }),
    );
    setAgentSkillsMap(map);
    setLoading(false);
  }, [agents]);

  useEffect(() => {
    void loadAllAgentSkills();
  }, [loadAllAgentSkills]);

  const toggleSkill = async (agent: Agent, skillKey: string) => {
    const config = agentSkillsMap.get(agent.id);
    if (!config || config.mode === "all") return;

    const cellKey = `${agent.id}:${skillKey}`;
    setToggling(cellKey);

    const inWhitelist = config.whitelist.includes(skillKey);
    const newWhitelist = inWhitelist
      ? config.whitelist.filter((s) => s !== skillKey)
      : [...config.whitelist, skillKey];

    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "skills.set",
          agentId: agent.id,
          skills: { mode: config.mode, whitelist: newWhitelist },
          baseHash: "",
        }),
      });
      if (res.ok) {
        setAgentSkillsMap((prev) => {
          const next = new Map(prev);
          next.set(agent.id, { ...config, whitelist: newWhitelist });
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  if (loading && agentSkillsMap.size === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">{tc("loading")}</span>
      </div>
    );
  }

  if (agents.length === 0 || skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        <p className="text-sm">{t("noSkills")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <TooltipProvider>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] sticky left-0 bg-[var(--muted)] z-10 min-w-[160px]">
                    {t("title")}
                  </th>
                  {agents.map((agent) => (
                    <th key={agent.id} className="px-3 py-2 text-center min-w-[80px]">
                      <button
                        type="button"
                        onClick={() => navigateToAgent(agent.id, "skills")}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium cursor-pointer",
                          "text-[var(--foreground)] hover:text-[var(--primary)]",
                          "transition-colors duration-150",
                        )}
                        title={agent.id}
                      >
                        <span className="truncate max-w-[72px]">{agent.name || agent.id}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skills.map((skill, rowIdx) => (
                  <tr
                    key={skill.key}
                    className={cn(
                      "border-b border-[var(--border)] last:border-b-0",
                      rowIdx % 2 === 1 && "bg-[var(--muted)]/50",
                    )}
                  >
                    <td className="px-3 py-2 sticky left-0 bg-[var(--card)] z-10">
                      <span className="font-mono text-[var(--foreground)]">{skill.name}</span>
                    </td>
                    {agents.map((agent) => (
                      <MatrixCell
                        key={agent.id}
                        agent={agent}
                        skill={skill}
                        config={agentSkillsMap.get(agent.id)}
                        toggling={toggling === `${agent.id}:${skill.key}`}
                        onToggle={() => void toggleSkill(agent, skill.key)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </div>
    </ScrollArea>
  );
}

function MatrixCell({
  agent,
  skill,
  config,
  toggling,
  onToggle,
}: {
  agent: Agent;
  skill: SkillEntry;
  config: AgentSkills | undefined;
  toggling: boolean;
  onToggle: () => void;
}) {
  // Loading spinner while toggling
  if (toggling) {
    return (
      <td className="px-3 py-2 text-center">
        <Loader2 size={14} className="animate-spin mx-auto text-[var(--muted-foreground)]" />
      </td>
    );
  }

  // No config loaded yet — show dash
  if (!config) {
    return <td className="px-3 py-2 text-center text-[var(--muted-foreground)]">-</td>;
  }

  // All mode — blue circle, not clickable
  if (config.mode === "all") {
    return (
      <td className="px-3 py-2 text-center">
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center justify-center w-6 h-6 rounded-full">
            <Circle size={14} className="text-blue-400 fill-blue-400/30" />
          </TooltipTrigger>
          <TooltipContent>
            此 Agent 使用全部 Skill，需先到 Agent 详情切换为白名单模式
          </TooltipContent>
        </Tooltip>
      </td>
    );
  }

  // Whitelist mode — check if skill is in whitelist
  const inWhitelist = config.whitelist.includes(skill.key);

  return (
    <td className="px-3 py-2 text-center">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-full cursor-pointer",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
          inWhitelist
            ? "text-emerald-400 hover:bg-emerald-500/15"
            : "text-red-400/60 hover:bg-red-500/15 hover:text-red-400",
        )}
        title={
          inWhitelist
            ? `Remove ${skill.key} from ${agent.name}`
            : `Add ${skill.key} to ${agent.name}`
        }
      >
        {inWhitelist ? <Check size={14} /> : <X size={14} />}
      </button>
    </td>
  );
}
