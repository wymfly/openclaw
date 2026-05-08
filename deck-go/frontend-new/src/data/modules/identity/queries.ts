import { useQuery } from "@tanstack/react-query";
import { fetchIdentityLinks } from "@/api";
import type { DeckGoIdentityLinksResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { identityKeys } from "./keys";

export function identityLinksQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoIdentityLinksResponse>(
    bff,
    bffSource("GET /deck/identity", () => fetchIdentityLinks()),
    identityKeys.links(scope),
    "config-authority",
  );
}

export function useIdentityLinksQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...identityLinksQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
