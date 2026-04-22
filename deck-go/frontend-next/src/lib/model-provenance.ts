export type RuntimeProviderSource = "config" | "agent-models" | "mixed" | "runtime";
export type AuthProviderSource = "config" | "auth-profile" | "agent-models" | "env" | "mixed";

export function sourceTranslationKey(source: string | null | undefined): string {
  switch (source) {
    case "config":
      return "config";
    case "agent-models":
      return "agentModels";
    case "auth-profile":
      return "authProfile";
    case "env":
      return "env";
    case "runtime":
      return "runtime";
    default:
      return "mixed";
  }
}

export function scopeTranslationKey(scope: string | null | undefined): string {
  if (typeof scope === "string" && scope.startsWith("agent:")) {
    return "agent";
  }
  return "global";
}
