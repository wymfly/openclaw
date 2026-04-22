"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";

interface AddModelSelectProps {
  models: Model[];
  auth: AuthOverviewEntry[];
  /** Model refs already in the chain (primary + fallbacks). */
  excludeRefs: string[];
  onAdd: (ref: string) => void;
}

/** Group models by provider, excluding those already in the chain. */
function groupAvailable(models: Model[], excludeRefs: Set<string>): Map<string, Model[]> {
  const map = new Map<string, Model[]>();
  for (const m of models) {
    const ref = `${m.provider}/${m.id}`;
    if (excludeRefs.has(ref)) {
      continue;
    }
    const key = m.provider || "unknown";
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(m);
  }
  return map;
}

/**
 * "+ Add Fallback Model" button that opens a grouped select dropdown.
 * Filters out models already present in the chain.
 */
export function AddModelSelect({ models, auth, excludeRefs, onAdd }: AddModelSelectProps) {
  const t = useTranslations("models");
  const excludeSet = useMemo(() => new Set(excludeRefs), [excludeRefs]);
  const grouped = useMemo(() => groupAvailable(models, excludeSet), [models, excludeSet]);

  const getAuthStatus = (provider: string) => {
    const entry = auth.find((a) => a.provider === provider);
    return entry?.status ?? "unknown";
  };

  const hasOptions = grouped.size > 0;

  return (
    <Select
      value=""
      onValueChange={(val) => {
        if (val) {
          onAdd(val);
        }
      }}
    >
      <SelectTrigger
        className="h-9 w-full cursor-pointer justify-center gap-1.5 border-dashed border-accent/30 bg-transparent text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
        disabled={!hasOptions}
      >
        <Plus size={14} className="shrink-0" />
        <SelectValue>{t("fallbacks.add")}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {[...grouped.entries()].map(([provider, provModels]) => (
          <SelectGroup key={provider}>
            <SelectLabel className="flex items-center gap-1.5 uppercase tracking-wider">
              <AuthStatusDot status={getAuthStatus(provider)} size="sm" />
              {provider}
            </SelectLabel>
            {provModels.map((m) => {
              const ref = `${m.provider}/${m.id}`;
              return (
                <SelectItem key={ref} value={ref}>
                  <span className="flex items-center gap-1.5">
                    <AuthStatusDot status={getAuthStatus(m.provider)} size="sm" />
                    <span>{m.name}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
