import { useEffect, useState } from "react";
import { useChatStore } from "../stores/chat";
import { getAdjacentPanel, getShortcutPanels } from "./panel-registry";
import { useDeckUI } from "./ui-store";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

function isShortcutHelpKey(event: KeyboardEvent) {
  return event.code === "Slash" || event.key === "/" || event.key === "?";
}

export function useDeckShortcuts() {
  const { activePanel, mobileNavOpen, setActivePanel, setMobileNavOpen, toggleSidebar } =
    useDeckUI();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const shortcutPanels = getShortcutPanels();

    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;

      if (event.altKey && !mod && !event.shiftKey) {
        const digit = Number.parseInt(event.key, 10);
        if (digit >= 1 && digit <= 9 && !isEditableTarget(event.target)) {
          event.preventDefault();
          const panel = shortcutPanels[digit - 1];
          if (panel) {
            setActivePanel(panel.id);
          }
          return;
        }
      }

      if (event.altKey && !mod && !event.shiftKey && event.key.toLowerCase() === "n") {
        if (!isEditableTarget(event.target)) {
          event.preventDefault();
          setActivePanel("chat");
          useChatStore.getState().setActiveSession(null);
          return;
        }
      }

      if (mod && event.shiftKey && !event.altKey && isShortcutHelpKey(event)) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLElement>("[data-panel-search]")?.focus();
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLElement>("[data-panel-search]")?.focus();
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && event.key === ",") {
        event.preventDefault();
        setActivePanel("settings");
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && event.key === "/") {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && (event.key === "[" || event.key === "]")) {
        if (!isEditableTarget(event.target)) {
          event.preventDefault();
          const next = getAdjacentPanel(activePanel, event.key === "]" ? "next" : "prev");
          if (next) {
            setActivePanel(next.id);
          }
        }
        return;
      }

      if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === "c") {
        if (!isEditableTarget(event.target)) {
          event.preventDefault();
          const store = useChatStore.getState();
          const session = store.activeSessionKey
            ? store.sessions.get(store.activeSessionKey)
            : null;
          const lastAssistant = session
            ? [...session.messages].toReversed().find((message) => message.role === "assistant")
            : null;
          const text = lastAssistant?.content
            .filter((block) => block.type === "text" && block.text.trim())
            .map((block) => (block.type === "text" ? block.text : ""))
            .join("\n");
          if (text) {
            void navigator.clipboard?.writeText(text);
          }
        }
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && event.key === "Enter") {
        const chatInput = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        if (chatInput?.value.trim()) {
          event.preventDefault();
          chatInput.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              ctrlKey: event.ctrlKey,
              key: "Enter",
              metaKey: event.metaKey,
            }),
          );
        }
        return;
      }

      if (event.key === "Escape" && !mod && !event.altKey && !event.shiftKey) {
        if (shortcutsOpen) {
          event.preventDefault();
          setShortcutsOpen(false);
          return;
        }
        if (mobileNavOpen) {
          event.preventDefault();
          setMobileNavOpen(false);
          return;
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, mobileNavOpen, setActivePanel, setMobileNavOpen, shortcutsOpen, toggleSidebar]);

  return { shortcutsOpen, setShortcutsOpen };
}
