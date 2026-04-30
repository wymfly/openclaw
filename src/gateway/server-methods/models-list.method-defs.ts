import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import {
  ModelsListParamsSchema,
  ModelsListResultSchema,
} from "../protocol/schema/agents-models-skills.js";

export const modelsListMethodDefs: Record<string, MethodMetadata> = {
  "models.list": {
    params: ModelsListParamsSchema,
    result: ModelsListResultSchema,
    scope: "operator.read",
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "models-list",
  priority: 70,
  methodDefs: modelsListMethodDefs,
};
