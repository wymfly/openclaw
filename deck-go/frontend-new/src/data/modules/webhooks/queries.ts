import { useQuery } from "@tanstack/react-query";
import { fetchWebhookDeliveries, fetchWebhooks } from "@/api";
import type { DeckGoWebhookDeliveriesResponse, DeckGoWebhooksResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { webhooksKeys } from "./keys";

export function webhooksListQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoWebhooksResponse>(
    bff,
    bffSource("GET /webhooks", () => fetchWebhooks()),
    webhooksKeys.list(scope),
    "inventory",
  );
}

export function webhookDeliveriesQueryOptions(
  bff: DataFabricBffTransport,
  webhookId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoWebhookDeliveriesResponse>(
    bff,
    bffSource("GET /webhooks/{id}/deliveries", () => fetchWebhookDeliveries(webhookId)),
    webhooksKeys.deliveries(webhookId, scope),
    "historical",
  );
}

export function useWebhooksListQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...webhooksListQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useWebhookDeliveriesQuery(
  webhookId: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeWebhookId = webhookId ?? "";
  return useQuery({
    ...webhookDeliveriesQueryOptions(bff, safeWebhookId, options.scope),
    enabled: enabledNonEmpty(webhookId, options.enabled ?? true),
  });
}
