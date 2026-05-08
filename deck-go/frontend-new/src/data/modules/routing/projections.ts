import type { QueryClient } from "@tanstack/react-query";
import { routingKeys } from "./keys";

export async function invalidateRoutingReadModel(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: routingKeys.all() });
}
