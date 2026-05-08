import { useQuery } from "@tanstack/react-query";
import { fetchAlertRules } from "@/api";
import type { DeckGoAlertsResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { alertsKeys } from "./keys";

export function alertRulesQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoAlertsResponse>(
    bff,
    bffSource("GET /alerts", () => fetchAlertRules()),
    alertsKeys.list(scope),
    "inventory",
  );
}

export function useAlertRulesQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...alertRulesQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
