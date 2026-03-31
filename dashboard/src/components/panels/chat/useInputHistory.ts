/**
 * Input history hook — 50-entry ring buffer backed by sessionStorage.
 * Mirrors official ui/src/ui/chat/input-history.ts logic.
 */
import { useCallback, useRef } from "react";

const MAX_HISTORY = 50;
const STORAGE_KEY = "deck-chat-input-history";

function loadFromStorage(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // sessionStorage quota exceeded — silently ignore
  }
}

export function useInputHistory() {
  const itemsRef = useRef<string[]>(loadFromStorage());
  const cursorRef = useRef(-1);
  /** Stores the in-progress draft when user starts navigating history. */
  const draftRef = useRef("");

  const push = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const items = itemsRef.current;
    // Dedup: skip if identical to last entry (same as official InputHistory)
    if (items[items.length - 1] === trimmed) {
      cursorRef.current = -1;
      return;
    }
    items.push(trimmed);
    if (items.length > MAX_HISTORY) items.shift();
    cursorRef.current = -1;
    saveToStorage(items);
  }, []);

  /** Navigate up (older). Returns the history entry, or null if already at top. */
  const up = useCallback((currentText: string): string | null => {
    const items = itemsRef.current;
    if (items.length === 0) return null;
    if (cursorRef.current < 0) {
      // First up press — save current draft
      draftRef.current = currentText;
      cursorRef.current = items.length - 1;
    } else if (cursorRef.current > 0) {
      cursorRef.current--;
    }
    return items[cursorRef.current] ?? null;
  }, []);

  /** Navigate down (newer). Returns history entry or restored draft if past end. */
  const down = useCallback((): string | null => {
    if (cursorRef.current < 0) return null;
    cursorRef.current++;
    const items = itemsRef.current;
    if (cursorRef.current >= items.length) {
      cursorRef.current = -1;
      return draftRef.current; // Restore the draft user was typing
    }
    return items[cursorRef.current] ?? null;
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = -1;
  }, []);

  return { push, up, down, reset };
}
