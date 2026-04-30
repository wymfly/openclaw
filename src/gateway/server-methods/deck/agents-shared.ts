export function resolveModelString(model: unknown): string | undefined {
  if (typeof model === "string") {
    return model || undefined;
  }
  if (model && typeof model === "object" && "primary" in model) {
    const primary = (model as { primary?: unknown }).primary;
    return typeof primary === "string" ? primary || undefined : undefined;
  }
  return undefined;
}
