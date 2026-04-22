"use client";

import { cn } from "@/lib/utils";

interface SessionKeyDisplayProps {
  sessionKey: string;
}

const segmentColors = [
  "text-[var(--primary)]",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-cyan-400",
];

/**
 * Parses a session key like "agent:coder:discord:channel:dev-help" into
 * colored segments for visual readability.
 */
export function SessionKeyDisplay({ sessionKey }: SessionKeyDisplayProps) {
  const segments = sessionKey.split(":");

  return (
    <span className="inline-flex items-center gap-0 font-mono text-xs">
      {segments.map((segment, i) => (
        <span key={i}>
          {i > 0 && <span className="text-[var(--muted-foreground)] opacity-40">:</span>}
          <span className={cn(segmentColors[i % segmentColors.length])}>{segment}</span>
        </span>
      ))}
    </span>
  );
}
