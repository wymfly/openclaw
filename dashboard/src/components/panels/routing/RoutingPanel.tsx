"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BindingTable } from "./BindingTable";
import { RouteSimulator } from "./RouteSimulator";

/**
 * Routing panel — binding rules table + route simulator.
 * Side-by-side at ≥1280px, stacked below.
 */
export function RoutingPanel() {
  const isWide = useMediaQuery("(min-width: 1280px)");

  if (isWide) {
    return (
      <div className="flex h-full gap-4 overflow-hidden">
        {/* Left: Binding Table — takes majority of space */}
        <div className="flex-[3] min-w-0 rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden">
          <BindingTable />
        </div>
        {/* Right: Route Simulator */}
        <div className="flex-[2] min-w-0 rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden">
          <RouteSimulator />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-auto">
      <div className="rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden min-h-[320px]">
        <BindingTable />
      </div>
      <div className="rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] overflow-hidden">
        <RouteSimulator />
      </div>
    </div>
  );
}
