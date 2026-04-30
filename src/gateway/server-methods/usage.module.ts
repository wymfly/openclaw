import type { GatewayMethodModule } from "../method-registry.js";
import { usageMethodDefs } from "./usage-method-defs.js";
import { usageHandlers } from "./usage.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "usage",
  priority: 290,
  handlers: usageHandlers,
  methodDefs: usageMethodDefs,
};
