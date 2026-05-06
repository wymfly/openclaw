import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import {
  ToolsEffectiveParamsSchema,
  ToolsEffectiveResultSchema,
} from "../protocol/schema/agents-models-skills.js";

export const toolsEffectiveMethodDefs: Record<string, MethodMetadata> = {
  "tools.effective": {
    params: ToolsEffectiveParamsSchema,
    result: ToolsEffectiveResultSchema,
    scope: READ_SCOPE,
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "tools-effective",
  priority: 190,
  methodDefs: toolsEffectiveMethodDefs,
};
