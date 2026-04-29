import type { PropsWithChildren } from "react";
import { FirstRunBanner } from "../components/runtime/FirstRunBanner";
import { DeckHeaderBar } from "./HeaderBar";
import { DeckNavRail } from "./NavRail";

export function DeckShell(props: PropsWithChildren) {
  return (
    <div className="deck-ui-shell">
      <DeckNavRail />
      <div className="deck-ui-main">
        <DeckHeaderBar />
        <FirstRunBanner />
        <main className="deck-ui-content">{props.children}</main>
      </div>
    </div>
  );
}
