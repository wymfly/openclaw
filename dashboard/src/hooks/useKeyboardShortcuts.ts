"use client";

import { useEffect } from "react";
import { useUIStore, type Panel } from "@/stores/ui";

/**
 * Ordered panel list matching NavRail display order (navGroups flattened).
 * Alt+1 through Alt+9 map to the first 9 entries.
 */
const NAV_PANELS: Panel[] = [
  "chat",
  "agents",
  "monitor",
  "models",
  "usage",
  "sessions",
  "memory",
  "logs",
  "routing",
];

/** Returns true when the active element is a text input or editable area. */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Global keyboard shortcuts for the dashboard.
 *
 * | Key               | Action                              |
 * |-------------------|-------------------------------------|
 * | Alt+1 ~ Alt+9     | Switch to NavRail panel 1–9         |
 * | Ctrl/Cmd+K        | Focus current panel's search input  |
 * | Ctrl/Cmd+Enter    | Send message (Chat panel)           |
 * | Escape            | Close mobile nav / blur focus        |
 * | Ctrl/Cmd+,        | Open Settings panel                 |
 * | Ctrl/Cmd+/        | Toggle NavRail collapse             |
 */
export function useKeyboardShortcuts() {
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // --- Alt+1 ~ Alt+9: panel navigation ---
      // Skip when user is typing in an input/textarea to avoid conflict.
      if (e.altKey && !mod && !e.shiftKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9 && !isEditableTarget(e.target)) {
          e.preventDefault();
          const panel = NAV_PANELS[digit - 1];
          if (panel) {
            setActivePanel(panel);
          }
          return;
        }
      }

      // --- Ctrl/Cmd+K: focus search input ---
      if (mod && e.key === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLElement>("[data-panel-search]");
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }

      // --- Ctrl/Cmd+Enter: send message in Chat panel ---
      if (mod && e.key === "Enter" && !e.shiftKey && !e.altKey) {
        const chatInput = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        if (chatInput && chatInput.value.trim()) {
          e.preventDefault();
          // Simulate Enter keypress on the chat textarea to trigger its own send handler.
          const enterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          });
          chatInput.dispatchEvent(enterEvent);
        }
        return;
      }

      // --- Escape: close mobile nav / blur active element ---
      if (e.key === "Escape" && !mod && !e.altKey && !e.shiftKey) {
        // Close mobile nav overlay if open
        const mobileNavOpen = useUIStore.getState().mobileNavOpen;
        if (mobileNavOpen) {
          e.preventDefault();
          setMobileNavOpen(false);
          return;
        }
        // Blur any focused element (effectively "cancel selection")
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // --- Ctrl/Cmd+, : open Settings ---
      if (mod && e.key === "," && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setActivePanel("settings");
        return;
      }

      // --- Ctrl/Cmd+/ : toggle NavRail collapse ---
      if (mod && e.key === "/" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setActivePanel, toggleSidebar, setMobileNavOpen]);
}
