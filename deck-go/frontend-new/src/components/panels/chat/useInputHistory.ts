import { useCallback, useRef } from "react";

const MAX_HISTORY = 50;
const STORAGE_KEY = "deck-chat-input-history";

function loadFromStorage(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota or unavailable-storage failures; history is a convenience.
  }
}

export function useInputHistory() {
  const itemsRef = useRef(loadFromStorage());
  const cursorRef = useRef(-1);
  const draftRef = useRef("");

  const push = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const items = itemsRef.current;
    if (items[items.length - 1] === trimmed) {
      cursorRef.current = -1;
      return;
    }
    items.push(trimmed);
    if (items.length > MAX_HISTORY) {
      items.shift();
    }
    cursorRef.current = -1;
    saveToStorage(items);
  }, []);

  const up = useCallback((currentText: string): string | null => {
    const items = itemsRef.current;
    if (items.length === 0) {
      return null;
    }
    if (cursorRef.current < 0) {
      draftRef.current = currentText;
      cursorRef.current = items.length - 1;
    } else if (cursorRef.current > 0) {
      cursorRef.current--;
    }
    return items[cursorRef.current] ?? null;
  }, []);

  const down = useCallback((): string | null => {
    if (cursorRef.current < 0) {
      return null;
    }
    cursorRef.current++;
    const items = itemsRef.current;
    if (cursorRef.current >= items.length) {
      cursorRef.current = -1;
      return draftRef.current;
    }
    return items[cursorRef.current] ?? null;
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = -1;
  }, []);

  return { push, up, down, reset };
}
