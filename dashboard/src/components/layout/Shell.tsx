"use client";

import { HeaderBar } from "./HeaderBar";
import { NavRail } from "./NavRail";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <NavRail />
      <div className="flex flex-col flex-1 min-w-0">
        <HeaderBar />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
