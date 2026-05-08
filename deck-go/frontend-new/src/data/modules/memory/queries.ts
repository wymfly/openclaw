import { useQuery } from "@tanstack/react-query";
import { browseMemory, fetchMemoryHealth, readMemoryFile, searchMemory } from "@/api";
import type {
  DeckGoMemoryBrowseResponse,
  DeckGoMemoryHealthResponse,
  DeckGoMemorySearchResponse,
  DeckGoMemorySearchScope,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { memoryKeys } from "./keys";

export function memoryBrowseQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  path?: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoMemoryBrowseResponse>(
    bff,
    bffSource("GET /memory/browse", () => browseMemory(agentId, path)),
    memoryKeys.browse(agentId, path, scope),
    "inventory",
  );
}

export function memoryFileQueryOptions(
  bff: DataFabricBffTransport,
  agentId: string,
  path: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoMemoryBrowseResponse>(
    bff,
    bffSource("GET /memory/browse?read=1", () => readMemoryFile(agentId, path)),
    memoryKeys.file(agentId, path, scope),
    "lazy-detail",
  );
}

export function memoryHealthQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoMemoryHealthResponse>(
    bff,
    bffSource("GET /memory/health", () => fetchMemoryHealth()),
    memoryKeys.health(scope),
    "lazy-detail",
  );
}

export function memorySearchQueryOptions(
  bff: DataFabricBffTransport,
  params: { agentId?: string; query: string; scope?: DeckGoMemorySearchScope },
  deckScope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoMemorySearchResponse>(
    bff,
    bffSource("POST /memory/search", () => searchMemory(params)),
    memoryKeys.search(params, deckScope),
    "inventory",
  );
}

export function useMemoryBrowseQuery(
  agentId: string | null | undefined,
  path?: string,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeAgentId = agentId ?? "";
  return useQuery({
    ...memoryBrowseQueryOptions(bff, safeAgentId, path, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true),
  });
}

export function useMemoryFileQuery(
  agentId: string | null | undefined,
  path: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeAgentId = agentId ?? "";
  const safePath = path ?? "";
  return useQuery({
    ...memoryFileQueryOptions(bff, safeAgentId, safePath, options.scope),
    enabled: enabledNonEmpty(agentId, options.enabled ?? true) && Boolean(path?.trim()),
  });
}

export function useMemoryHealthQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...memoryHealthQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useMemorySearchQuery(
  params: { agentId?: string; query: string; scope?: DeckGoMemorySearchScope },
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...memorySearchQueryOptions(bff, params, options.scope),
    enabled: (options.enabled ?? true) && Boolean(params.query.trim()),
  });
}
