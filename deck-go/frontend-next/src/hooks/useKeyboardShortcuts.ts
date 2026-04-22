"use client";

import { useEffect, useState } from "react";
import { getShortcutPanels } from "@/lib/panel-registry";
import { useUIStore, type Panel } from "@/stores/ui";

const NAV_PANELS = getShortcutPanels().map((p) => p.id as Panel);

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
 * | Key                | Action                              |
 * |--------------------|-------------------------------------|
 * | Alt+1 ~ Alt+9      | Switch to NavRail panel 1–9         |
 * | Ctrl/Cmd+K         | Focus current panel's search input  |
 * | Ctrl/Cmd+Enter     | Send message (Chat panel)           |
 * | Escape             | Close mobile nav / blur focus        |
 * | Ctrl/Cmd+,         | Open Settings panel                 |
 * | Ctrl/Cmd+/         | Toggle NavRail collapse             |
 * | Ctrl/Cmd+Shift+/   | Show keyboard shortcuts help        |
 * | Alt+N              | New chat session                    |
 * | Ctrl/Cmd+Shift+K   | Command palette (panel search)      |
 * | Ctrl/Cmd+[ / ]     | Previous / next panel               |
 * | Ctrl/Cmd+Shift+C   | Copy last assistant reply            |
 */
export function useKeyboardShortcuts() {
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // --- Alt+1 ~ Alt+9: panel navigation ---
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

      // --- Alt+N: new session ---
      if (e.altKey && !mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          setActivePanel("chat");
          // Clear active session to show EmptyState (new session screen)
          const { useChatStore } = require("@/stores/chat") as {
            useChatStore: { getState: () => { setActiveSession: (k: string | null) => void } };
          };
          useChatStore.getState().setActiveSession(null);
          return;
        }
      }

      // --- Ctrl/Cmd+Shift+/: show shortcuts help ---
      if (mod && e.shiftKey && e.key === "/" && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // --- Ctrl/Cmd+Shift+K: command palette (focus panel search) ---
      if (mod && e.shiftKey && e.key.toLowerCase() === "k" && !e.altKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLElement>("[data-panel-search]");
        if (searchInput) {
          searchInput.focus();
        }
        return;
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

      // --- Ctrl/Cmd+[ / ]: prev/next panel ---
      if (mod && !e.shiftKey && !e.altKey && (e.key === "[" || e.key === "]")) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          const current = useUIStore.getState().activePanel;
          const idx = NAV_PANELS.indexOf(current);
          if (idx >= 0) {
            const next =
              e.key === "]"
                ? NAV_PANELS[(idx + 1) % NAV_PANELS.length]
                : NAV_PANELS[(idx - 1 + NAV_PANELS.length) % NAV_PANELS.length];
            if (next) {
              setActivePanel(next);
            }
          }
          return;
        }
      }

      // --- Ctrl/Cmd+Shift+C: copy last assistant reply ---
      if (mod && e.shiftKey && e.key.toLowerCase() === "c" && !e.altKey) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          // Read from store instead of DOM — no data-role attribute on message elements
          const { useChatStore } = require("@/stores/chat") as {
            useChatStore: {
              getState: () => {
                activeSessionKey: string | null;
                sessions: Map<
                  string,
                  {
                    messages: Array<{
                      role: string;
                      content: Array<{ type: string; text?: string }>;
                    }>;
                  }
                >;
              };
            };
          };
          const store = useChatStore.getState();
          const session = store.activeSessionKey
            ? store.sessions.get(store.activeSessionKey)
            : undefined;
          if (session) {
            const lastAssistant = [...session.messages]
              .toReversed()
              .find((m) => m.role === "assistant");
            if (lastAssistant) {
              const text = lastAssistant.content
                .filter((b) => b.type === "text" && b.text)
                .map((b) => b.text)
                .join("\n");
              if (text) {
                void navigator.clipboard.writeText(text);
              }
            }
          }
          return;
        }
      }

      // --- Ctrl/Cmd+Enter: send message in Chat panel ---
      if (mod && e.key === "Enter" && !e.shiftKey && !e.altKey) {
        const chatInput = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        if (chatInput && chatInput.value.trim()) {
          e.preventDefault();
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
        const mobileNavOpen = useUIStore.getState().mobileNavOpen;
        if (mobileNavOpen) {
          e.preventDefault();
          setMobileNavOpen(false);
          return;
        }
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

  return { shortcutsOpen, setShortcutsOpen };
}
