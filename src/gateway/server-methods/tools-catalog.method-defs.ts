import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import {
  ToolsCatalogParamsSchema,
  ToolsCatalogResultSchema,
} from "../protocol/schema/agents-models-skills.js";

export const toolsCatalogMethodDefs: Record<string, MethodMetadata> = {
  "tools.catalog": {
    params: ToolsCatalogParamsSchema,
    result: ToolsCatalogResultSchema,
    scope: READ_SCOPE,
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "tools-catalog",
  priority: 180,
  methodDefs: toolsCatalogMethodDefs,
};
