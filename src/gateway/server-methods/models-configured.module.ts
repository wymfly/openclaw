import type { GatewayMethodModule } from "../method-registry.js";
import { modelsConfiguredHandlers, modelsConfiguredMethodDefs } from "./models-configured.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "models-configured",
  priority: 130,
  handlers: modelsConfiguredHandlers,
  methodDefs: modelsConfiguredMethodDefs,
};
