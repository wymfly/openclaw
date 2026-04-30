import type { GatewayMethodModule } from "../method-registry.js";
import { toolsCatalogHandlers } from "./tools-catalog.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "tools-catalog",
  priority: 180,
  handlers: toolsCatalogHandlers,
};
