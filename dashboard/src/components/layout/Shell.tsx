"use client";

import { useEffect } from "react";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { useGatewayStore } from "@/stores/gateway";
import { HeaderBar } from "./HeaderBar";
import { NavRail } from "./NavRail";

const HEALTH_POLL_MS = 30_000;

export function Shell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const fetchHealth = useGatewayStore((s) => s.fetchHealth);

  useEffect(() => {
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, [fetchHealth]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* NavRail handles its own visibility:
          - Desktop: expanded sidebar
          - Tablet: collapsed (icon-only) sidebar
          - Mobile: hidden, rendered as overlay when mobileNavOpen */}
      <NavRail />
      <div className="flex flex-col flex-1 min-w-0">
        <HeaderBar />
        <main className={`flex-1 overflow-auto ${isMobile ? "p-2" : "p-4"}`}>{children}</main>
      </div>
    </div>
  );
}
