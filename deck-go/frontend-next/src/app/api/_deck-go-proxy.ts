type DeckGoProxyOptions = {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
};

function getDeckGoApiBase(): string {
  const raw =
    process.env.DECK_GO_API_BASE?.trim() ?? process.env.NEXT_PUBLIC_DECK_GO_API_BASE?.trim() ?? "";
  return raw.replace(/\/+$/, "");
}

function copyRequestHeaders(request: Request, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  for (const name of ["authorization", "x-deck-token", "last-event-id", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return headers;
}

export async function fetchDeckGo(
  request: Request,
  path: string,
  options: DeckGoProxyOptions = {},
): Promise<Response | null> {
  const apiBase = getDeckGoApiBase();
  if (!apiBase) {
    return null;
  }

  const target = `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (options.method ?? request.method).toUpperCase();
  const body =
    options.body !== undefined
      ? options.body
      : method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

  const response = await fetch(target, {
    method,
    headers: copyRequestHeaders(request, options.headers),
    body,
  });

  return new Response(response.body, {
    status: response.status,
    headers: copyResponseHeaders(response.headers),
  });
}

export async function maybeProxyToDeckGo(request: Request, path: string): Promise<Response | null> {
  return fetchDeckGo(request, path);
}

export function deckGoUnavailableResponse(
  message = "Deck Go control-plane API base not configured",
): Response {
  return Response.json({ error: message }, { status: 503 });
}
