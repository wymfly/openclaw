export type DataFreshnessTier =
  | "static"
  | "runtime-liveness"
  | "config-authority"
  | "inventory"
  | "live-workbench"
  | "historical"
  | "lazy-detail"
  | "stream-driven";

export type DataFreshnessPolicy = {
  gcTime: number;
  refetchOnMount: false;
  refetchOnReconnect: boolean | "always";
  refetchOnWindowFocus: boolean;
  staleTime: number;
  tier: DataFreshnessTier;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const dataFreshnessTiers: readonly DataFreshnessTier[] = [
  "static",
  "runtime-liveness",
  "config-authority",
  "inventory",
  "live-workbench",
  "historical",
  "lazy-detail",
  "stream-driven",
];

export const dataFreshnessPolicies = {
  static: {
    gcTime: 24 * HOUR_MS,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    tier: "static",
  },
  "runtime-liveness": {
    gcTime: 5 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    tier: "runtime-liveness",
  },
  "config-authority": {
    gcTime: 30 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    staleTime: 90_000,
    tier: "config-authority",
  },
  inventory: {
    gcTime: 10 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    staleTime: MINUTE_MS,
    tier: "inventory",
  },
  "live-workbench": {
    gcTime: 5 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    tier: "live-workbench",
  },
  historical: {
    gcTime: 30 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    staleTime: 5 * MINUTE_MS,
    tier: "historical",
  },
  "lazy-detail": {
    gcTime: 10 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    staleTime: MINUTE_MS,
    tier: "lazy-detail",
  },
  "stream-driven": {
    gcTime: 5 * MINUTE_MS,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    tier: "stream-driven",
  },
} satisfies Record<DataFreshnessTier, DataFreshnessPolicy>;

export function getDataFreshnessPolicy(tier: DataFreshnessTier): DataFreshnessPolicy {
  const policy = dataFreshnessPolicies[tier];
  return { ...policy };
}
