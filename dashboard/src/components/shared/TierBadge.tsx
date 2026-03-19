"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: string;
}

const tierColors: Record<string, string> = {
  peer: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "peer.parent": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "guild+roles": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  guild: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  team: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  account: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  channel: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  default: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

/** Badge displaying a routing tier with color-coded priority. */
export function TierBadge({ tier }: TierBadgeProps) {
  const colorClass = tierColors[tier] ?? tierColors.default;

  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono uppercase border", colorClass)}>
      {tier}
    </Badge>
  );
}
