import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { modelsConfiguredMethodDefs } from "./models-configured.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "models-configured",
  priority: 71,
  methodDefs: modelsConfiguredMethodDefs,
};
