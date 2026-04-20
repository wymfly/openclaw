import { useEffect } from "react";
import { getAdjacentRestoredPanel, getRestoredShortcutPanels } from "./panel-registry";
import { useRestorationUI } from "./ui-store";

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

export function useRestorationShortcuts() {
  const { activePanel, mobileNavOpen, setActivePanel, setMobileNavOpen, toggleSidebar } =
    useRestorationUI();

  useEffect(() => {
    const shortcutPanels = getRestoredShortcutPanels();

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
          const next = getAdjacentRestoredPanel(activePanel, event.key === "]" ? "next" : "prev");
          if (next) {
            setActivePanel(next.id);
          }
        }
        return;
      }

      if (event.key === "Escape" && !mod && !event.altKey && !event.shiftKey) {
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
  }, [activePanel, mobileNavOpen, setActivePanel, setMobileNavOpen, toggleSidebar]);
}
