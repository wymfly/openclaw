import type { GatewayMethodModule } from "../method-registry.js";
import { toolsEffectiveHandlers } from "./tools-effective.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "tools-effective",
  priority: 190,
  handlers: toolsEffectiveHandlers,
};
