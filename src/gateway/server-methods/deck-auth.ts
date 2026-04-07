import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { runAuthProbes, type AuthProbeResult } from "../../commands/models/list.probe.js";
import { loadConfig } from "../../config/config.js";
import type { MethodMetadata } from "../method-registry.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  DeckAuthOverviewResultSchema,
  DeckAuthProbeResultSchema,
} from "../protocol/schema/deck.js";
import { createProviderProvenance } from "./model-provider-provenance.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * In-flight probe deduplication map.
 *
 * When multiple dashboard clients request a probe for the same provider
 * concurrently, we coalesce them into a single probe run and share the
 * result. The map is keyed by provider id and holds a promise that
 * resolves to the first probe result.
 */
const inflightProbes = new Map<string, Promise<AuthProbeResult | null>>();

export const deckAuthHandlers: GatewayRequestHandlers = {
  "deck.auth.overview": async ({ respond }) => {
    try {
      const cfg = loadConfig();
      const agentDir = resolveOpenClawAgentDir();
      const provenance = createProviderProvenance(cfg, agentDir);
      const providers = provenance.visibleProviders;

      const result = await buildAuthOverview({ providers, cfg, agentDir });
      respond(
        true,
        {
          providers: result.providers.map((entry) => {
            const meta = provenance.inspect(entry.provider);
            return {
              ...entry,
              source: meta.authSource,
              scope: meta.scope,
              configPresent: meta.configPresent,
              authPresent: meta.authPresent,
              editable: meta.editable,
            };
          }),
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "deck.auth.probe": async ({ params, respond }) => {
    const provider = typeof params.provider === "string" ? params.provider.trim() : undefined;
    if (!provider) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "missing required param: provider"),
      );
      return;
    }

    const profileId =
      typeof params.profileId === "string" ? params.profileId.trim() || undefined : undefined;
    const timeoutMs =
      typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : 8_000;
    const maxTokens =
      typeof params.maxTokens === "number" && params.maxTokens > 0 ? params.maxTokens : 8;

    // Deduplicate concurrent probes for the same provider.
    const dedupeKey = profileId ? `${provider}:${profileId}` : provider;
    const existing = inflightProbes.get(dedupeKey);
    if (existing) {
      try {
        const result = await existing;
        if (result) {
          respond(true, result, undefined);
        } else {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.UNAVAILABLE, "probe returned no results"),
          );
        }
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
      }
      return;
    }

    const probePromise = (async (): Promise<AuthProbeResult | null> => {
      const cfg = loadConfig();
      const providers = createProviderProvenance(cfg, resolveOpenClawAgentDir()).visibleProviders;

      // Build model candidates from config for probe target selection.
      const defaultModel = cfg.agents?.defaults?.model;
      const rawModel =
        typeof defaultModel === "string"
          ? defaultModel
          : typeof defaultModel === "object" && defaultModel !== null
            ? (((defaultModel as Record<string, unknown>).primary as string) ?? "")
            : "";
      const modelCandidates = rawModel ? [rawModel] : [];

      const agentId = resolveDefaultAgentId(cfg);
      const summary = await runAuthProbes({
        cfg,
        providers,
        modelCandidates,
        options: {
          provider,
          profileIds: profileId ? [profileId] : undefined,
          timeoutMs,
          concurrency: 1,
          maxTokens,
        },
      });

      // Clean up temp session files created by probe.
      // Probes write to sessions dir under `probe-*` prefix; cleanup is
      // best-effort and not critical.
      try {
        const { resolveSessionTranscriptsDirForAgent } =
          await import("../../config/sessions/paths.js");
        const { default: fs } = await import("node:fs/promises");
        const sessionDir = resolveSessionTranscriptsDirForAgent(agentId);
        const entries = await fs.readdir(sessionDir).catch(() => []);
        const staleFiles = entries.filter(
          (name) => name.startsWith(`probe-${provider}-`) && name.endsWith(".jsonl"),
        );
        await Promise.allSettled(
          staleFiles.map((name) => fs.unlink(`${sessionDir}/${name}`).catch(() => {})),
        );
      } catch {
        // Best-effort cleanup; ignore errors.
      }

      // Filter out skipped/excluded entries — only return an actual probe result.
      // Skip entries have status "unknown" with a reasonCode; real probes have
      // status in {"ok","auth","rate_limit","timeout","billing","format","no_model"}.
      const actualStatuses = new Set([
        "ok",
        "auth",
        "rate_limit",
        "timeout",
        "billing",
        "format",
        "no_model",
      ]);
      const match = summary.results.find(
        (r) => actualStatuses.has(r.status) && (!provider || r.provider === provider),
      );
      return match ?? summary.results.find((r) => actualStatuses.has(r.status)) ?? null;
    })();

    inflightProbes.set(dedupeKey, probePromise);

    try {
      const result = await probePromise;
      if (result) {
        respond(true, result, undefined);
      } else {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "probe returned no results"));
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    } finally {
      inflightProbes.delete(dedupeKey);
    }
  },
};

export const deckAuthMethodDefs: Record<string, MethodMetadata> = {
  "deck.auth.overview": {
    result: DeckAuthOverviewResultSchema,
    scope: "operator.read",
  },
  "deck.auth.probe": {
    result: DeckAuthProbeResultSchema,
    scope: "operator.write",
  },
};
