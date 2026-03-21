const STORAGE_KEY = "deck:blockFilters";

export interface ChatBlockPreferences {
  showThinking: boolean;
  showToolUse: boolean;
  showToolResult: boolean;
}

const DEFAULTS: ChatBlockPreferences = {
  showThinking: true,
  showToolUse: true,
  showToolResult: true,
};

export function loadBlockPreferences(): ChatBlockPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULTS };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      showThinking:
        typeof obj.showThinking === "boolean" ? obj.showThinking : DEFAULTS.showThinking,
      showToolUse: typeof obj.showToolUse === "boolean" ? obj.showToolUse : DEFAULTS.showToolUse,
      showToolResult:
        typeof obj.showToolResult === "boolean" ? obj.showToolResult : DEFAULTS.showToolResult,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBlockPreferences(prefs: ChatBlockPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
