import type { GatewayMethodModule } from "../method-registry.js";
import { systemHandlers } from "./system.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "system",
  priority: 230,
  handlers: systemHandlers,
};
