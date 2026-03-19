"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useGatewayStore } from "@/stores/gateway";
import { HeaderBar } from "./HeaderBar";
import { NavRail } from "./NavRail";

/** Health-check interval: 30 seconds. */
const HEALTH_POLL_MS = 30_000;

export function Shell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const fetchHealth = useGatewayStore((s) => s.fetchHealth);

  // Initial health check + periodic polling to keep status pill accurate.
  useEffect(() => {
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, [fetchHealth]);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
        <NavRail />
        <div className="flex flex-col flex-1 min-w-0">
          <HeaderBar />
          <main className={cn("flex-1 overflow-auto", isMobile ? "p-3" : "p-5")}>{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
