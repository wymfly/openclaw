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
  forkClass?: "C1" | "C2" | "C3" | "C4" | "C5";
  bffEligible?: boolean;
  controlPlaneWrite?: boolean;
}

export type MethodMetadata = Omit<MethodDefinition, "handler">;

export interface EventDefinition {
  payload?: TSchema;
  since?: number;
}

export interface GatewayMethodMetadataModule {
  name: string;
  priority?: number;
  methodDefs?: Record<string, MethodMetadata>;
  events?: Record<string, EventDefinition>;
}

export interface GatewayMethodModule extends GatewayMethodMetadataModule {
  handlers: GatewayRequestHandlers;
}

export interface LoadedGatewayMethodModules {
  handlers: GatewayRequestHandlers;
  methodDefs: Record<string, MethodMetadata>;
  events: Record<string, EventDefinition>;
  modules: readonly GatewayMethodModule[];
  metadataModules: readonly GatewayMethodMetadataModule[];
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
      forkClass?: "C1" | "C2" | "C3" | "C4" | "C5";
      bffEligible?: boolean;
      controlPlaneWrite?: boolean;
    }
  >;
  events: Record<
    string,
    {
      payload?: Record<string, unknown>;
      since?: number;
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).toSorted(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sortGatewayModules<T extends GatewayMethodMetadataModule>(modules: readonly T[]): T[] {
  return [...modules].toSorted((left, right) => {
    const priority = (left.priority ?? 100) - (right.priority ?? 100);
    if (priority !== 0) {
      return priority;
    }
    return left.name.localeCompare(right.name);
  });
}

export function loadGatewayMethodMetadataModules(modules: readonly GatewayMethodMetadataModule[]): {
  methodDefs: Record<string, MethodMetadata>;
  events: Record<string, EventDefinition>;
  metadataModules: readonly GatewayMethodMetadataModule[];
} {
  const methodDefs: Record<string, MethodMetadata> = {};
  const events: Record<string, EventDefinition> = {};
  const eventOwners = new Map<string, string>();
  const sortedModules = sortGatewayModules(modules);

  for (const module of sortedModules) {
    for (const [method, def] of Object.entries(module.methodDefs ?? {})) {
      // Metadata modules may intentionally refine an earlier broad metadata
      // set; duplicate runtime handlers still fail fast below.
      methodDefs[method] = def;
    }

    for (const [event, def] of Object.entries(module.events ?? {})) {
      const previousOwner = eventOwners.get(event);
      if (previousOwner) {
        throw new Error(
          `duplicate gateway event metadata "${event}" in ${previousOwner} and ${module.name}`,
        );
      }
      eventOwners.set(event, module.name);
      events[event] = def;
    }
  }

  return {
    methodDefs,
    events,
    metadataModules: sortedModules,
  };
}

export function loadGatewayMethodModules(
  modules: readonly GatewayMethodModule[],
  metadataModules: readonly GatewayMethodMetadataModule[] = modules,
): LoadedGatewayMethodModules {
  const handlers: GatewayRequestHandlers = {};
  const handlerOwners = new Map<string, string>();
  const sortedModules = sortGatewayModules(modules);

  for (const module of sortedModules) {
    for (const [method, handler] of Object.entries(module.handlers)) {
      const previousOwner = handlerOwners.get(method);
      if (previousOwner) {
        throw new Error(
          `duplicate gateway method handler "${method}" in ${previousOwner} and ${module.name}`,
        );
      }
      handlerOwners.set(method, module.name);
      handlers[method] = handler;
    }
  }

  const metadata = loadGatewayMethodMetadataModules(metadataModules);
  return {
    handlers,
    methodDefs: metadata.methodDefs,
    events: metadata.events,
    modules: sortedModules,
    metadataModules: metadata.metadataModules,
  };
}

function computeSchemaVersion(
  methods: ReadonlyMap<string, MethodDefinition>,
  events: ReadonlyMap<string, EventDefinition>,
): string {
  const sorted = stableStringify({
    events: [...events.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([name, def]) => ({
        name,
        payload: def.payload,
        since: def.since,
      })),
    methods: [...methods.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([name, def]) => ({
        deprecated: def.deprecated,
        bffEligible: def.bffEligible,
        controlPlaneWrite: def.controlPlaneWrite,
        forkClass: def.forkClass,
        name,
        params: def.params,
        result: def.result,
        scope: def.scope,
        since: def.since,
      })),
  });
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
      forkClass: meta?.forkClass,
      bffEligible: meta?.bffEligible,
      controlPlaneWrite: meta?.controlPlaneWrite,
    });
  }

  const schemaVersion = computeSchemaVersion(methods, events);

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
          forkClass?: "C1" | "C2" | "C3" | "C4" | "C5";
          bffEligible?: boolean;
          controlPlaneWrite?: boolean;
        } = {
          scope: def.scope,
        };
        if (def.since !== undefined) {
          entry.since = def.since;
        }
        if (def.forkClass !== undefined) {
          entry.forkClass = def.forkClass;
        }
        if (def.bffEligible !== undefined) {
          entry.bffEligible = def.bffEligible;
        }
        if (def.controlPlaneWrite !== undefined) {
          entry.controlPlaneWrite = def.controlPlaneWrite;
        }
        if (includeSchemas) {
          if (def.params) {
            entry.params = def.params as unknown as Record<string, unknown>;
          }
          if (def.result) {
            entry.result = def.result as unknown as Record<string, unknown>;
          }
        }
        result.methods[name] = entry;
      }

      for (const [name, eventDef] of events) {
        const entry: { payload?: Record<string, unknown>; since?: number } = {};
        if (eventDef.since !== undefined) {
          entry.since = eventDef.since;
        }
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
