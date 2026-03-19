"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { HeaderBar } from "./HeaderBar";
import { NavRail } from "./NavRail";

export function Shell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* NavRail handles its own visibility:
            - Desktop: expanded sidebar
            - Tablet: collapsed (icon-only) sidebar with tooltips
            - Mobile: hidden, rendered as Sheet overlay when mobileNavOpen */}
        <NavRail />
        <div className="flex flex-col flex-1 min-w-0">
          <HeaderBar />
          <main className={`flex-1 overflow-auto ${isMobile ? "p-2" : "p-4"}`}>{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
