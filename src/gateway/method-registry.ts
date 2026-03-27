import type { TSchema } from "@sinclair/typebox";
import type { OperatorScope } from "./method-scopes.js";
import { PROTOCOL_VERSION } from "./protocol/schema/protocol-schemas.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./server-methods/types.js";

export interface MethodDefinition {
  handler: GatewayRequestHandler;
  params?: TSchema;
  result?: TSchema;
  scope: OperatorScope | "node" | "public";
  since?: number;
  deprecated?: boolean;
}

export type MethodMetadata = Omit<MethodDefinition, "handler">;

export interface EventDefinition {
  payload?: TSchema;
  since?: number;
}

export interface GatewayDescribePayload {
  protocol: number;
  schemaVersion: string;
  methods: Record<
    string,
    {
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
      scope: string;
      since?: number;
    }
  >;
  events: Record<
    string,
    {
      payload?: Record<string, unknown>;
    }
  >;
  untyped: string[];
}

export interface MethodRegistry {
  methods: ReadonlyMap<string, MethodDefinition>;
  events: ReadonlyMap<string, EventDefinition>;
  listMethods(): string[];
  listEvents(): string[];
  getDefinition(method: string): MethodDefinition | undefined;
  getEventDefinition(event: string): EventDefinition | undefined;
  getScopeForMethod(method: string): OperatorScope | "node" | "public" | undefined;
  describe(opts?: {
    filter?: "all" | "typed" | "untyped";
    includeSchemas?: boolean;
  }): GatewayDescribePayload;
}

function computeSchemaVersion(methods: ReadonlyMap<string, MethodDefinition>): string {
  const sorted = [...methods.keys()].sort().join(",");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return `${PROTOCOL_VERSION}.${(hash >>> 0).toString(36)}`;
}

export function buildMethodRegistry(
  handlers: GatewayRequestHandlers,
  metadataSets: Array<Record<string, MethodMetadata>>,
  eventDefs?: Record<string, EventDefinition>,
): MethodRegistry {
  const methods = new Map<string, MethodDefinition>();
  const events = new Map<string, EventDefinition>(Object.entries(eventDefs ?? {}));

  const mergedMeta = new Map<string, MethodMetadata>();
  for (const defs of metadataSets) {
    for (const [method, meta] of Object.entries(defs)) {
      if (!handlers[method]) {
        throw new Error(
          `methodDefs references "${method}" but no handler exists. ` +
            `Check that the handler is registered in coreGatewayHandlers.`,
        );
      }
      mergedMeta.set(method, meta);
    }
  }

  for (const [method, handler] of Object.entries(handlers)) {
    const meta = mergedMeta.get(method);
    methods.set(method, {
      handler,
      params: meta?.params,
      result: meta?.result,
      scope: meta?.scope ?? "public",
      since: meta?.since,
      deprecated: meta?.deprecated,
    });
  }

  const schemaVersion = computeSchemaVersion(methods);

  function isTyped(def: MethodDefinition): boolean {
    return def.params !== undefined || def.result !== undefined;
  }

  const registry: MethodRegistry = {
    methods,
    events,

    listMethods() {
      return [...methods.keys()];
    },

    listEvents() {
      return [...events.keys()];
    },

    getDefinition(method: string) {
      return methods.get(method);
    },

    getEventDefinition(event: string) {
      return events.get(event);
    },

    getScopeForMethod(method: string) {
      return methods.get(method)?.scope;
    },

    describe(opts) {
      const filter = opts?.filter ?? "all";
      const includeSchemas = opts?.includeSchemas ?? false;

      const result: GatewayDescribePayload = {
        protocol: PROTOCOL_VERSION,
        schemaVersion,
        methods: {},
        events: {},
        untyped: [],
      };

      for (const [name, def] of methods) {
        const typed = isTyped(def);

        if (filter === "typed" && !typed) {
          continue;
        }
        if (filter === "untyped" && typed) {
          continue;
        }

        if (!typed) {
          result.untyped.push(name);
          continue;
        }

        const entry: {
          params?: Record<string, unknown>;
          result?: Record<string, unknown>;
          scope: string;
          since?: number;
        } = {
          scope: def.scope,
        };
        if (def.since !== undefined) entry.since = def.since;
        if (includeSchemas) {
          if (def.params) entry.params = def.params as unknown as Record<string, unknown>;
          if (def.result) entry.result = def.result as unknown as Record<string, unknown>;
        }
        result.methods[name] = entry;
      }

      for (const [name, eventDef] of events) {
        const entry: { payload?: Record<string, unknown> } = {};
        if (includeSchemas && eventDef.payload) {
          entry.payload = eventDef.payload as unknown as Record<string, unknown>;
        }
        result.events[name] = entry;
      }

      return result;
    },
  };

  return registry;
}
