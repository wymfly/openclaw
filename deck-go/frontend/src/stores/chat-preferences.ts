const STORAGE_KEY = "deck:blockFilters";

export interface ChatBlockPreferences {
  showThinking?: boolean;
  showToolUse?: boolean;
  showToolResult?: boolean;
}

const DEFAULTS: Required<ChatBlockPreferences> = {
  showThinking: true,
  showToolUse: true,
  showToolResult: true,
};

export function loadBlockPreferences(): Required<ChatBlockPreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showThinking: prefs.showThinking ?? DEFAULTS.showThinking,
        showToolUse: prefs.showToolUse ?? DEFAULTS.showToolUse,
        showToolResult: prefs.showToolResult ?? DEFAULTS.showToolResult,
      }),
    );
  } catch {
    // Storage may be unavailable in private or embedded browser contexts.
  }
}
