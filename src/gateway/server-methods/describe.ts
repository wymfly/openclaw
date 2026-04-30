import { Type } from "@sinclair/typebox";
import type { GatewayDescribePayload } from "../method-registry.js";
import type { MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import type { GatewayRequestHandlers } from "./types.js";

const JsonObjectSchema = Type.Record(Type.String(), Type.Unknown());

export const GatewayDescribeParamsSchema = Type.Object({
  filter: Type.Optional(
    Type.Unsafe<"all" | "typed" | "untyped">({
      type: "string",
      enum: ["all", "typed", "untyped"],
    }),
  ),
  includeSchemas: Type.Optional(Type.Boolean()),
});

export const GatewayDescribeResultSchema = Type.Object({
  protocol: Type.Number(),
  schemaVersion: Type.String(),
  methods: Type.Record(
    Type.String(),
    Type.Object({
      params: Type.Optional(JsonObjectSchema),
      result: Type.Optional(JsonObjectSchema),
      scope: Type.String(),
      since: Type.Optional(Type.Number()),
      forkClass: Type.Optional(
        Type.Unsafe<"C1" | "C2" | "C3" | "C4" | "C5">({
          type: "string",
          enum: ["C1", "C2", "C3", "C4", "C5"],
        }),
      ),
      forkDeprecated: Type.Optional(Type.Boolean()),
      forkDeprecationReplacement: Type.Optional(Type.String()),
      forkDeprecationSince: Type.Optional(Type.String()),
      forkDeprecationRemovalTarget: Type.Optional(Type.String()),
      bffEligible: Type.Optional(Type.Boolean()),
      controlPlaneWrite: Type.Optional(Type.Boolean()),
    }),
  ),
  events: Type.Record(
    Type.String(),
    Type.Object({
      payload: Type.Optional(JsonObjectSchema),
      since: Type.Optional(Type.Number()),
    }),
  ),
  untyped: Type.Array(Type.String()),
});

type DescribeRegistry = {
  describe: (opts?: {
    filter?: "all" | "typed" | "untyped";
    includeSchemas?: boolean;
  }) => GatewayDescribePayload;
};

let registryRef: DescribeRegistry | null = null;

export function setDescribeRegistry(registry: DescribeRegistry): void {
  registryRef = registry;
}

function normalizeFilter(value: unknown): "all" | "typed" | "untyped" {
  return value === "typed" || value === "untyped" ? value : "all";
}

export const describeHandlers: GatewayRequestHandlers = {
  "gateway.describe": ({ params, respond }) => {
    if (!registryRef) {
      respond(false, undefined, {
        code: "UNAVAILABLE",
        message: "gateway method registry is not initialized",
      });
      return;
    }
    respond(
      true,
      registryRef.describe({
        filter: normalizeFilter(params?.filter),
        includeSchemas: params?.includeSchemas === true,
      }),
    );
  },
};

export const describeMethodDefs: Record<string, MethodMetadata> = {
  "gateway.describe": {
    params: GatewayDescribeParamsSchema,
    result: GatewayDescribeResultSchema,
    scope: READ_SCOPE,
    forkClass: "C5",
    bffEligible: false,
  },
};
