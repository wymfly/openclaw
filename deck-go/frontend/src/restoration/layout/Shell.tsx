import type { PropsWithChildren } from "react";
import { RestoredHeaderBar } from "./HeaderBar";
import { RestoredNavRail } from "./NavRail";

export function RestoredShell(props: PropsWithChildren) {
  return (
    <div className="deckgo-restored-shell">
      <RestoredNavRail />
      <div className="deckgo-restored-main">
        <RestoredHeaderBar />
        <main className="deckgo-restored-content">{props.children}</main>
      </div>
    </div>
  );
}
