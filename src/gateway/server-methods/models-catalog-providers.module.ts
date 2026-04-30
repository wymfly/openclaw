import type { GatewayMethodModule } from "../method-registry.js";
import { modelsCatalogProvidersHandlers } from "./models-catalog-providers.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "models-catalog-providers",
  priority: 140,
  handlers: modelsCatalogProvidersHandlers,
};
