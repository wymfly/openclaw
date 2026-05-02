import { ChatPanel } from "../components/panels/chat/ChatPanel";
import { ActivePanelHost } from "./ActivePanelHost";
import { useDeckUI } from "./ui-store";

export function DeckPanelHost() {
  const { activePanel } = useDeckUI();

  if (activePanel === "chat") {
    return <ChatPanel />;
  }

  return <ActivePanelHost />;
}
