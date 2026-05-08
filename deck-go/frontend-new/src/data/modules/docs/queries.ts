import { useQuery } from "@tanstack/react-query";
import { fetchDoc, fetchDocs } from "@/api";
import type { DeckGoDoc, DeckGoDocsResponse } from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  enabledNonEmpty,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { docsKeys, type DocsListFilters } from "./keys";

export function docsListQueryOptions(
  bff: DataFabricBffTransport,
  filters?: DocsListFilters,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoDocsResponse>(
    bff,
    bffSource("GET /docs", () => (filters ? fetchDocs(filters) : fetchDocs())),
    docsKeys.list(filters, scope),
    "inventory",
  );
}

export function docDetailQueryOptions(
  bff: DataFabricBffTransport,
  docId: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions<DeckGoDoc>(
    bff,
    bffSource("GET /docs/{docId}", () => fetchDoc(docId)),
    docsKeys.detail(docId, scope),
    "lazy-detail",
  );
}

export function useDocsListQuery(filters?: DocsListFilters & ModuleQueryOptions) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...docsListQueryOptions(bff, filters, filters?.scope),
    enabled: filters?.enabled ?? true,
  });
}

export function useDocDetailQuery(
  docId: string | null | undefined,
  options: ModuleQueryOptions = {},
) {
  const { bff } = useDataFabricTransports();
  const safeDocId = docId ?? "";
  return useQuery({
    ...docDetailQueryOptions(bff, safeDocId, options.scope),
    enabled: enabledNonEmpty(docId, options.enabled ?? true),
  });
}
