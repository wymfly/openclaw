import type { GatewayMethodModule } from "../method-registry.js";
import { modelsListMethodDefs } from "./models-list.method-defs.js";
import { modelsHandlers } from "./models.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "models",
  priority: 130,
  handlers: modelsHandlers,
  methodDefs: modelsListMethodDefs,
};
