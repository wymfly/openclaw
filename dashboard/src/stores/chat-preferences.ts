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
    return { ...DEFAULTS, ...JSON.parse(raw) };
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
