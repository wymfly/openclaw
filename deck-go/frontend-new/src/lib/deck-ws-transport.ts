import type {
  GatewayMethodMap,
  GatewayMethodName,
} from "../../../contracts/generated/ts/gateway/protocol";
import { GatewayError, type GatewayErrorPayload } from "./gateway-client";
import { DEFAULT_RUNTIME_ID } from "./runtime-id";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type GatewayWSFrame = {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: unknown;
  ok?: boolean;
  payload?: unknown;
  event?: string;
  error?: GatewayErrorPayload;
};

export type DeckWebSocketTransportOptions = {
  accessToken?: string | null;
  runtimeId?: string;
  url?: string;
  WebSocketCtor?: typeof WebSocket;
};

export class DeckGatewayWebSocketTransport {
  private readonly ws: WebSocket;
  private readonly pending = new Map<string, PendingRequest>();
  private nextId = 0;

  constructor(options: DeckWebSocketTransportOptions = {}) {
    const runtimeId = options.runtimeId ?? DEFAULT_RUNTIME_ID;
    const token = options.accessToken?.trim();
    const base = options.url ?? `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/gateway/ws`;
    const url = token ? appendToken(base, token) : base;
    const WebSocketCtor = options.WebSocketCtor ?? globalThis.WebSocket;
    this.ws = new WebSocketCtor(url);
    this.ws.addEventListener("message", (event) => this.handleMessage(event));
    this.ws.addEventListener("close", () => this.rejectAll("Gateway WebSocket closed."));
    this.ws.addEventListener("error", () => this.rejectAll("Gateway WebSocket failed."));
  }

  request<M extends GatewayMethodName>(
    method: M,
    params: GatewayMethodMap[M]["params"],
  ): Promise<GatewayMethodMap[M]["result"]> {
    const id = `ws-${++this.nextId}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    }) as Promise<GatewayMethodMap[M]["result"]>;
  }

  close() {
    this.ws.close();
  }

  private handleMessage(event: MessageEvent) {
    const frame = parseFrame(event.data);
    if (!frame || frame.type !== "res" || !frame.id) {
      return;
    }
    const pending = this.pending.get(frame.id);
    if (!pending) {
      return;
    }
    this.pending.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.payload);
      return;
    }
    pending.reject(
      new GatewayError({
        code: frame.error?.code ?? "gateway_ws_error",
        details: frame.error?.details,
        message: frame.error?.message ?? "Gateway WebSocket request failed.",
        status: 0,
      }),
    );
  }

  private rejectAll(message: string) {
    for (const pending of this.pending.values()) {
      pending.reject(new GatewayError({ code: "gateway_ws_closed", message, status: 0 }));
    }
    this.pending.clear();
  }
}

function appendToken(base: string, token: string) {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

function parseFrame(data: unknown): GatewayWSFrame | null {
  try {
    return JSON.parse(String(data)) as GatewayWSFrame;
  } catch {
    return null;
  }
}
