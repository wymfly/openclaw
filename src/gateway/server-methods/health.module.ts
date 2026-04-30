import type { GatewayMethodModule } from "../method-registry.js";
import { healthHandlers } from "./health.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "health",
  priority: 40,
  handlers: healthHandlers,
};
