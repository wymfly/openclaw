export type DeckGoApiBaseScope = "browser" | "server";

function normalizeDeckGoApiBase(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

export function getDeckGoApiBase(scope: DeckGoApiBaseScope = "server"): string {
  const publicBase = normalizeDeckGoApiBase(process.env.NEXT_PUBLIC_DECK_GO_API_BASE);
  if (scope === "browser") {
    return publicBase;
  }

  return normalizeDeckGoApiBase(process.env.DECK_GO_API_BASE) || publicBase;
}

export function resolveDeckGoApiPath(
  path: string,
  scope: DeckGoApiBaseScope = "server",
): string | null {
  const apiBase = getDeckGoApiBase(scope);
  if (!apiBase) {
    return null;
  }

  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
}
