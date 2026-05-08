import type { QueryClient } from "@tanstack/react-query";
import { usageKeys } from "./keys";

export async function invalidateUsageObservability(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: usageKeys.cost() }),
    queryClient.invalidateQueries({ queryKey: usageKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: usageKeys.sessions() }),
  ]);
}
