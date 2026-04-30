import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE, READ_SCOPE } from "../method-scopes.js";
import {
  ConfigApplyParamsSchema,
  ConfigGetParamsSchema,
  ConfigGetResultSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaLookupParamsSchema,
  ConfigSchemaLookupResultSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaResponseSchema,
  ConfigSetParamsSchema,
  ConfigWriteResultSchema,
} from "../protocol/schema/config.js";

export const configMethodDefs: Record<string, MethodMetadata> = {
  "config.get": {
    params: ConfigGetParamsSchema,
    result: ConfigGetResultSchema,
    scope: READ_SCOPE,
  },
  "config.schema": {
    params: ConfigSchemaParamsSchema,
    result: ConfigSchemaResponseSchema,
    scope: ADMIN_SCOPE,
  },
  "config.schema.lookup": {
    params: ConfigSchemaLookupParamsSchema,
    result: ConfigSchemaLookupResultSchema,
    scope: READ_SCOPE,
  },
  "config.apply": {
    params: ConfigApplyParamsSchema,
    result: ConfigWriteResultSchema,
    scope: ADMIN_SCOPE,
    controlPlaneWrite: true,
  },
  "config.patch": {
    params: ConfigPatchParamsSchema,
    result: ConfigWriteResultSchema,
    scope: ADMIN_SCOPE,
    controlPlaneWrite: true,
  },
  "config.set": {
    params: ConfigSetParamsSchema,
    result: ConfigWriteResultSchema,
    scope: ADMIN_SCOPE,
  },
};
