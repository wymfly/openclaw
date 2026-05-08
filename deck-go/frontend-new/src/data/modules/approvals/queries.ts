import { useQuery } from "@tanstack/react-query";
import { fetchApprovalsPolicy, fetchPendingApprovals, fetchPluginApprovals } from "@/api";
import type {
  DeckGoApprovalPolicyResponse,
  DeckGoPendingApprovalsResponse,
  DeckGoPluginApprovalsResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { approvalsKeys } from "./keys";

export function approvalsPolicyQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoApprovalPolicyResponse>(
    bff,
    bffSource("GET /approvals/policy", () => fetchApprovalsPolicy()),
    approvalsKeys.policy(scope),
    "config-authority",
  );
}

export function pendingApprovalsQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoPendingApprovalsResponse>(
    bff,
    bffSource("GET /approvals/pending", () => fetchPendingApprovals()),
    approvalsKeys.pending(scope),
    "live-workbench",
  );
}

export function pluginApprovalsQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoPluginApprovalsResponse>(
    bff,
    bffSource("GET /approvals/plugins", () => fetchPluginApprovals()),
    approvalsKeys.plugins(scope),
    "live-workbench",
  );
}

export function useApprovalsPolicyQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...approvalsPolicyQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function usePendingApprovalsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...pendingApprovalsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function usePluginApprovalsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...pluginApprovalsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
