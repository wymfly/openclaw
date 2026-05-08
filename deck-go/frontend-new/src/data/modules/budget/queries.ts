import { useQuery } from "@tanstack/react-query";
import { evaluateBudgetRules, fetchBudgetRules } from "@/api";
import type { DeckGoBudgetEvaluationsResponse, DeckGoBudgetRulesResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { budgetKeys } from "./keys";

export function budgetRulesQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoBudgetRulesResponse>(
    bff,
    bffSource("GET /usage/budget", () => fetchBudgetRules()),
    budgetKeys.rules(scope),
    "inventory",
  );
}

export function budgetEvaluationsQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoBudgetEvaluationsResponse>(
    bff,
    bffSource("GET /usage/budget/evaluate", () => evaluateBudgetRules()),
    budgetKeys.evaluations(scope),
    "live-workbench",
  );
}

export function useBudgetRulesQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...budgetRulesQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useBudgetEvaluationsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...budgetEvaluationsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
