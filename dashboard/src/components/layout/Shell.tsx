"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { HeaderBar } from "./HeaderBar";
import { NavRail } from "./NavRail";

export function Shell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

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
