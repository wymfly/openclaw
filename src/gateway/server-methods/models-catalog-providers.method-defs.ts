import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import { ModelsCatalogProvidersResultSchema } from "../protocol/schema/control-plane-results.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "models-catalog-providers",
  priority: 75,
  methodDefs: {
    "models.catalog.providers": {
      result: ModelsCatalogProvidersResultSchema,
      scope: READ_SCOPE,
      forkClass: "C4",
      bffEligible: false,
    },
  },
};
