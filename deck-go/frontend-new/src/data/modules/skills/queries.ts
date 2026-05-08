import { useQuery } from "@tanstack/react-query";
import {
  fetchPluginApprovals,
  fetchSkillHubBins,
  fetchSkillHubDetail,
  fetchSkills,
  searchSkillHub,
} from "@/api";
import type {
  DeckGoPluginApprovalsResponse,
  DeckGoSkillHubBinsResponse,
  DeckGoSkillHubDetailResponse,
  DeckGoSkillHubSearchResponse,
  DeckGoSkillsResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import { bffQueryOptions, bffSource, type ModuleQueryOptions } from "../shared";
import { skillsKeys } from "./keys";

export function skillsListQueryOptions(
  bff: Parameters<typeof bffQueryOptions<DeckGoSkillsResponse>>[0],
  filters?: { agentId?: string | null },
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    bffSource("GET /skills", () => fetchSkills(filters?.agentId ?? undefined)),
    skillsKeys.list(filters ?? {}, scope),
    "inventory",
  );
}

export function skillApprovalsQueryOptions(
  bff: Parameters<typeof bffQueryOptions<DeckGoPluginApprovalsResponse>>[0],
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    bffSource("GET /approvals/plugins", () => fetchPluginApprovals()),
    skillsKeys.approvals(scope),
    "inventory",
  );
}

export function skillHubBinsQueryOptions(
  bff: Parameters<typeof bffQueryOptions<DeckGoSkillHubBinsResponse>>[0],
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    bffSource("POST /skills/hub#bins", () => fetchSkillHubBins()),
    skillsKeys.hubBins(scope),
    "inventory",
  );
}

export function skillHubSearchQueryOptions(
  bff: Parameters<typeof bffQueryOptions<DeckGoSkillHubSearchResponse>>[0],
  query: string,
  limit = 20,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    bffSource("POST /skills/hub#search", () => searchSkillHub(query, limit)),
    skillsKeys.hubSearch(query, limit, scope),
    "lazy-detail",
  );
}

export function skillHubDetailQueryOptions(
  bff: Parameters<typeof bffQueryOptions<DeckGoSkillHubDetailResponse>>[0],
  slug: string,
  scope?: DeckQueryScope,
) {
  return bffQueryOptions(
    bff,
    bffSource("POST /skills/hub#detail", () => fetchSkillHubDetail(slug)),
    skillsKeys.hubDetail(slug, scope),
    "lazy-detail",
  );
}

export function useSkillsListQuery(filters?: { agentId?: string | null } & ModuleQueryOptions) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...skillsListQueryOptions(bff, filters, filters?.scope),
    enabled: filters?.enabled ?? true,
  });
}

export function useSkillApprovalsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...skillApprovalsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useSkillHubBinsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...skillHubBinsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useSkillHubSearchQuery(
  query: string,
  options: ModuleQueryOptions & { limit?: number } = {},
) {
  const { bff } = useDataFabricTransports();
  const limit = options.limit ?? 20;
  return useQuery({
    ...skillHubSearchQueryOptions(bff, query, limit, options.scope),
    enabled: (options.enabled ?? true) && Boolean(query.trim()),
  });
}

export function useSkillHubDetailQuery(slug: string, options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...skillHubDetailQueryOptions(bff, slug, options.scope),
    enabled: (options.enabled ?? true) && Boolean(slug.trim()),
  });
}
