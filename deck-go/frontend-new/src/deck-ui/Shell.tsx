import type { PropsWithChildren } from "react";
import { FirstRunBanner } from "../components/runtime/FirstRunBanner";
import { DeckHeaderBar } from "./HeaderBar";
import { DeckNavRail } from "./NavRail";
import { useDeckUI } from "./ui-store";

export function DeckShell(props: PropsWithChildren) {
  const { activePanel } = useDeckUI();
  const contentClasses = [
    "deck-ui-content",
    activePanel === "chat" ? "deck-ui-content--workbench" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="deck-ui-shell" data-active-panel={activePanel}>
      <DeckNavRail />
      <div className="deck-ui-main">
        <DeckHeaderBar />
        <FirstRunBanner />
        <main className={contentClasses} data-active-panel={activePanel}>
          {props.children}
        </main>
      </div>
    </div>
  );
}
