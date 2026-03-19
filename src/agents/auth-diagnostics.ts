import type { OpenClawConfig } from "../config/config.js";
import type { ProviderUsageSnapshot, UsageSummary } from "../infra/provider-usage.types.js";
import {
  type AuthHealthSummary,
  type AuthProviderHealth,
  type AuthProviderHealthStatus,
  buildAuthHealthSummary,
} from "./auth-health.js";
import {
  type AuthProfileStore,
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveProfileUnusableUntilForDisplay,
} from "./auth-profiles.js";
import type { AuthProfileFailureReason } from "./auth-profiles/types.js";
import { resolveProfilesUnavailableReason } from "./auth-profiles/usage.js";

export type AuthOverviewEntry = {
  provider: string;
  status: "ready" | "warning" | "missing" | "unknown";
  auth: {
    type: "api_key" | "oauth" | "token" | "aws-sdk" | null;
    source: string;
    profileId?: string;
  } | null;
  oauth?: {
    expiresAt: number;
    remainingMs: number;
    status: "ok" | "expiring" | "expired" | "missing";
  };
  cooldown?: {
    reason: "rate_limit" | "auth" | "billing";
    remainingMs: number;
    until: number;
  };
  usage?: {
    windows: Array<{ label: string; usedPercent: number; resetsInMs: number }>;
    plan?: string;
  };
};

/** Map auth-health provider status to the simplified UI status. */
function mapHealthStatusToUiStatus(
  healthStatus: AuthProviderHealthStatus,
): AuthOverviewEntry["status"] {
  switch (healthStatus) {
    case "ok":
    case "static":
      return "ready";
    case "expiring":
      return "warning";
    case "expired":
    case "missing":
      return "missing";
    default:
      return "unknown";
  }
}

/** Map a failure reason to the simplified cooldown reason for the overview. */
function mapFailureReasonToCooldownReason(
  reason: AuthProfileFailureReason,
): "rate_limit" | "auth" | "billing" {
  switch (reason) {
    case "billing":
      return "billing";
    case "auth":
    case "auth_permanent":
      return "auth";
    default:
      return "rate_limit";
  }
}

/**
 * Resolve the best available auth credential info for a provider.
 *
 * Inspects the profile store to find the first usable profile and
 * returns its type + source label. Falls back to `null` when no
 * profiles exist for the provider.
 *
 * When `preferApiKey` is true (used when OAuth/token credentials are
 * expired or missing), the function preferentially selects an api_key
 * profile that is not in cooldown — implementing the "fallback to
 * static credential" behaviour described in the spec.
 */
function resolveAuthEntry(
  store: AuthProfileStore,
  provider: string,
  opts?: { preferApiKey?: boolean },
): AuthOverviewEntry["auth"] {
  const profileIds = listProfilesForProvider(store, provider);
  if (profileIds.length === 0) {
    return null;
  }

  const now = Date.now();
  const isUsable = (id: string) => {
    const until = resolveProfileUnusableUntilForDisplay(store, id);
    return !until || now >= until;
  };

  // When expirable credentials are degraded, prefer a static api_key.
  if (opts?.preferApiKey) {
    const apiKeyId = profileIds.find(
      (id) => store.profiles[id]?.type === "api_key" && isUsable(id),
    );
    if (apiKeyId) {
      return { type: "api_key", source: "store", profileId: apiKeyId };
    }
  }

  // Default: pick the first usable profile; fall back to the first profile.
  const bestProfileId = profileIds.find(isUsable) ?? profileIds[0];
  const profile = store.profiles[bestProfileId];
  if (!profile) {
    return null;
  }

  return {
    type: profile.type,
    source: "store",
    profileId: bestProfileId,
  };
}

/**
 * Resolve cooldown info for a provider from the profile store.
 *
 * Finds the earliest active cooldown among all profiles for the provider
 * and reports the inferred failure reason.
 */
function resolveCooldownEntry(
  store: AuthProfileStore,
  provider: string,
): AuthOverviewEntry["cooldown"] | undefined {
  const profileIds = listProfilesForProvider(store, provider);
  if (profileIds.length === 0) {
    return undefined;
  }

  const now = Date.now();
  let soonestUntil: number | null = null;

  for (const id of profileIds) {
    const until = resolveProfileUnusableUntilForDisplay(store, id);
    if (typeof until === "number" && until > now) {
      if (soonestUntil === null || until < soonestUntil) {
        soonestUntil = until;
      }
    }
  }

  if (soonestUntil === null) {
    return undefined;
  }

  const failureReason = resolveProfilesUnavailableReason({
    store,
    profileIds,
    now,
  });

  return {
    reason: mapFailureReasonToCooldownReason(failureReason ?? "rate_limit"),
    remainingMs: soonestUntil - now,
    until: soonestUntil,
  };
}

/**
 * Build an auth overview for the given list of providers.
 *
 * Merges data from:
 * 1. Auth profile store (credential type + source)
 * 2. Auth health summary (OAuth expiry status)
 * 3. Cooldown/disabled status per profile
 * 4. Provider usage windows (optional — passed in if available)
 */
export async function buildAuthOverview(params: {
  providers: string[];
  cfg: OpenClawConfig;
  agentDir: string;
  store?: AuthProfileStore;
  usageSummary?: UsageSummary;
}): Promise<{ providers: AuthOverviewEntry[] }> {
  const store = params.store ?? ensureAuthProfileStore(params.agentDir);

  const healthSummary: AuthHealthSummary = buildAuthHealthSummary({
    store,
    cfg: params.cfg,
    providers: params.providers,
  });

  const healthByProvider = new Map<string, AuthProviderHealth>();
  for (const entry of healthSummary.providers) {
    healthByProvider.set(entry.provider, entry);
  }

  const usageByProvider = new Map<string, ProviderUsageSnapshot>();
  if (params.usageSummary) {
    for (const snapshot of params.usageSummary.providers) {
      usageByProvider.set(snapshot.provider, snapshot);
    }
  }

  const now = Date.now();

  const entries: AuthOverviewEntry[] = params.providers.map((provider) => {
    const health = healthByProvider.get(provider);
    const profileIds = listProfilesForProvider(store, provider);
    const hasProfiles = profileIds.length > 0;

    // Determine base status from health summary.
    // Distinguish "no profiles at all" (unknown) from "has profiles but
    // all credentials missing/expired" (missing).
    const baseHealthStatus: AuthOverviewEntry["status"] = health
      ? hasProfiles
        ? mapHealthStatusToUiStatus(health.status)
        : "unknown"
      : "unknown";

    // When expirable credentials are degraded, try to fall back to a
    // static api_key profile that is not in cooldown.
    const needsFallback = baseHealthStatus === "missing" || baseHealthStatus === "warning";
    const auth = resolveAuthEntry(store, provider, {
      preferApiKey: needsFallback,
    });

    let status = baseHealthStatus;

    // Build OAuth info if the provider has expiry data
    let oauth: AuthOverviewEntry["oauth"] | undefined;
    if (health?.expiresAt && typeof health.remainingMs === "number") {
      oauth = {
        expiresAt: health.expiresAt,
        remainingMs: health.remainingMs,
        status: health.status as "ok" | "expiring" | "expired" | "missing",
      };
    }

    // Build cooldown info
    const cooldown = resolveCooldownEntry(store, provider);

    // Build usage info
    let usage: AuthOverviewEntry["usage"] | undefined;
    const usageSnapshot = usageByProvider.get(provider);
    if (usageSnapshot && usageSnapshot.windows.length > 0) {
      usage = {
        windows: usageSnapshot.windows.map((w) => ({
          label: w.label,
          usedPercent: w.usedPercent,
          resetsInMs: typeof w.resetAt === "number" ? w.resetAt - now : 0,
        })),
        plan: usageSnapshot.plan,
      };
    }

    // Upgrade status: if health says expired/missing but a usable api_key
    // profile was selected as fallback, treat as ready.
    if (needsFallback && auth?.type === "api_key" && !cooldown) {
      status = "ready";
    }

    return {
      provider,
      status,
      auth,
      ...(oauth ? { oauth } : {}),
      ...(cooldown ? { cooldown } : {}),
      ...(usage ? { usage } : {}),
    };
  });

  return { providers: entries };
}
