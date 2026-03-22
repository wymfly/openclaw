"use client";

import { Check, Circle, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Filter agents and skills by search term (case-insensitive match on name)
  const query = searchTerm.toLowerCase().trim();
  const filteredAgents = useMemo(
    () =>
      query
        ? agents.filter(
            (a) =>
              (a.name || a.id).toLowerCase().includes(query) || a.id.toLowerCase().includes(query),
          )
        : agents,
    [agents, query],
  );
  const filteredSkills = useMemo(
    () =>
      query
        ? skills.filter(
            (s) => s.name.toLowerCase().includes(query) || s.key.toLowerCase().includes(query),
          )
        : skills,
    [skills, query],
  );

  const toggleSkill = async (agent: Agent, skillKey: string) => {
    const config = agentSkillsMap.get(agent.id);
    if (!config || config.mode === "all") return;

    const cellKey = `${agent.id}:${skillKey}`;
    setToggling(cellKey);
    setToggleError(null);

    const inSkills = config.skills.includes(skillKey);
    const newSkills = inSkills
      ? config.skills.filter((s) => s !== skillKey)
      : [...config.skills, skillKey];

    // Optimistic update
    const prevConfig = config;
    setAgentSkillsMap((prev) => {
      const next = new Map(prev);
      next.set(agent.id, { ...config, skills: newSkills });
      return next;
    });

    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "skills.set",
          agentId: agent.id,
          mode: config.mode,
          skills: newSkills,
          baseHash: config.configHash ?? "",
        }),
      });
      if (!res.ok) {
        // Revert optimistic update on failure
        setAgentSkillsMap((prev) => {
          const next = new Map(prev);
          next.set(agent.id, prevConfig);
          return next;
        });
        const data = await res.json().catch(() => ({ error: "Toggle failed" }));
        setToggleError((data as { error?: string }).error ?? "Toggle failed");
        return;
      }
      // Re-fetch to get updated configHash
      const refreshRes = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skills.get", agentId: agent.id }),
      });
      if (refreshRes.ok) {
        const refreshed = (await refreshRes.json()) as AgentSkills;
        setAgentSkillsMap((prev) => {
          const next = new Map(prev);
          next.set(agent.id, refreshed);
          return next;
        });
      }
    } catch {
      // Revert optimistic update on network error
      setAgentSkillsMap((prev) => {
        const next = new Map(prev);
        next.set(agent.id, prevConfig);
        return next;
      });
      setToggleError("Network error — skill toggle failed");
    } finally {
      setToggling(null);
    }
  };

  if (loading && agentSkillsMap.size === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">{tc("loading")}</span>
      </div>
    );
  }

  if (agents.length === 0 || skills.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        <p className="text-sm">{t("noSkills")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {/* Search input */}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
          />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("matrixSearch")}
            className="h-7 text-xs pl-7"
          />
        </div>
        {toggleError && (
          <div className="mb-3 px-3 py-2 rounded-md text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
            <span>{toggleError}</span>
            <button
              type="button"
              onClick={() => setToggleError(null)}
              className="ml-2 text-red-400 hover:text-red-300 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <TooltipProvider>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-tertiary)] z-10 min-w-[160px]">
                    {t("title")}
                  </th>
                  {filteredAgents.map((agent) => (
                    <th key={agent.id} className="px-3 py-2 text-center min-w-[80px]">
                      <button
                        type="button"
                        onClick={() => navigateToAgent(agent.id, "skills")}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium cursor-pointer",
                          "text-[var(--text-primary)] hover:text-[var(--accent)]",
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
                {filteredSkills.map((skill, rowIdx) => (
                  <tr
                    key={skill.key}
                    className={cn(
                      "border-b border-[var(--border)] last:border-b-0",
                      rowIdx % 2 === 1 && "bg-[var(--bg-tertiary)]/50",
                    )}
                  >
                    <td className="px-3 py-2 sticky left-0 bg-[var(--bg-secondary)] z-10">
                      <span className="font-mono text-[var(--text-primary)]">{skill.name}</span>
                    </td>
                    {filteredAgents.map((agent) => (
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
  const t = useTranslations("skills");

  // Loading spinner while toggling
  if (toggling) {
    return (
      <td className="px-3 py-2 text-center">
        <Loader2 size={14} className="animate-spin mx-auto text-[var(--text-secondary)]" />
      </td>
    );
  }

  // No config loaded yet — show dash
  if (!config) {
    return <td className="px-3 py-2 text-center text-[var(--text-secondary)]">-</td>;
  }

  // Ineligible — skill disabled or missing requirements → gray circle, not clickable
  const isIneligible =
    skill.status === "disabled" ||
    (Array.isArray(skill.missingRequirements) && skill.missingRequirements.length > 0);

  if (isIneligible) {
    const reasons = skill.missingRequirements?.join(", ") ?? "";
    return (
      <td className="px-3 py-2 text-center">
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center justify-center w-6 h-6 rounded-full cursor-default">
            <Circle
              size={14}
              className="text-[var(--text-secondary)] fill-[var(--text-secondary)]/20"
            />
          </TooltipTrigger>
          <TooltipContent>
            {t("ineligibleReason")}
            {reasons ? `: ${reasons}` : ""}
          </TooltipContent>
        </Tooltip>
      </td>
    );
  }

  // All mode — blue circle, not clickable
  if (config.mode === "all") {
    return (
      <td className="px-3 py-2 text-center">
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center justify-center w-6 h-6 rounded-full">
            <Circle size={14} className="text-blue-400 fill-blue-400/30" />
          </TooltipTrigger>
          <TooltipContent>{t("allModeTooltip")}</TooltipContent>
        </Tooltip>
      </td>
    );
  }

  // Whitelist mode — check if skill is in assigned skills list
  const isAssigned = config.skills.includes(skill.key);

  return (
    <td className="px-3 py-2 text-center">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-full cursor-pointer",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
          isAssigned
            ? "text-emerald-400 hover:bg-emerald-500/15"
            : "text-red-400/60 hover:bg-red-500/15 hover:text-red-400",
        )}
        title={
          isAssigned
            ? `Remove ${skill.key} from ${agent.name}`
            : `Add ${skill.key} to ${agent.name}`
        }
      >
        {isAssigned ? <Check size={14} /> : <X size={14} />}
      </button>
    </td>
  );
}
