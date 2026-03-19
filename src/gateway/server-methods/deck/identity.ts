import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  writeConfigFile,
} from "../../../config/config.js";
import type { OpenClawConfig } from "../../../config/types.openclaw.js";
import {
  errorShape,
  validateDeckIdentityLinkParams,
  validateDeckIdentityListParams,
  validateDeckIdentityUnlinkParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { validateBaseHash } from "./utils.js";

/** Split "channel:peerId" on the FIRST ":" only (peerId may contain ":"). */
function splitChannelPeer(raw: string): { channel: string; peerId: string } | null {
  const idx = raw.indexOf(":");
  if (idx < 1) {
    return null;
  }
  return { channel: raw.slice(0, idx), peerId: raw.slice(idx + 1) };
}

/** Read identityLinks from config and return structured view + configHash. */
async function resolveIdentityLinksPayload() {
  const config = loadConfig();
  const identityLinks: Record<string, string[]> = config.session?.identityLinks ?? {};
  const { snapshot } = await readConfigFileSnapshotForWrite();
  const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

  const links = Object.entries(identityLinks).map(([canonical, rawPeers]) => ({
    canonical,
    peers: (rawPeers ?? [])
      .map(splitChannelPeer)
      .filter((p): p is { channel: string; peerId: string } => p !== null),
  }));

  return { links, configHash, snapshot };
}

export const deckIdentityHandlers: GatewayRequestHandlers = {
  "deck.identity.list": async ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckIdentityListParams, "deck.identity.list", respond)) {
      return;
    }
    const { links, configHash } = await resolveIdentityLinksPayload();
    respond(true, { links, configHash });
  },

  "deck.identity.link": async ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckIdentityLinkParams, "deck.identity.link", respond)) {
      return;
    }
    const { canonical, channel, peerId, baseHash } = params as {
      canonical: string;
      channel: string;
      peerId: string;
      baseHash: string;
    };

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";

    const hashErr = validateBaseHash(baseHash, currentHash);
    if (hashErr) {
      respond(false, undefined, errorShape(hashErr.code, hashErr.message));
      return;
    }

    const config: OpenClawConfig = snapshot.config ?? loadConfig();
    const identityLinks: Record<string, string[]> = { ...config.session?.identityLinks };
    const entry = `${channel}:${peerId}`;
    const existing = identityLinks[canonical] ?? [];

    // Deduplicate — if already present, respond ok without writing
    if (existing.includes(entry)) {
      respond(true, { ok: true, configHash: currentHash });
      return;
    }

    identityLinks[canonical] = [...existing, entry];
    const nextConfig: OpenClawConfig = {
      ...config,
      session: { ...config.session, identityLinks },
    };

    await writeConfigFile(nextConfig, writeOptions);

    // Re-read to get new hash
    const { snapshot: newSnap } = await readConfigFileSnapshotForWrite();
    const newHash = resolveConfigSnapshotHash(newSnap) ?? "";

    respond(true, { ok: true, configHash: newHash });
  },

  "deck.identity.unlink": async ({ params, respond }) => {
    if (
      !assertValidParams(params, validateDeckIdentityUnlinkParams, "deck.identity.unlink", respond)
    ) {
      return;
    }
    const { canonical, channel, peerId, baseHash } = params as {
      canonical: string;
      channel: string;
      peerId: string;
      baseHash: string;
    };

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";

    const hashErr = validateBaseHash(baseHash, currentHash);
    if (hashErr) {
      respond(false, undefined, errorShape(hashErr.code, hashErr.message));
      return;
    }

    const config: OpenClawConfig = snapshot.config ?? loadConfig();
    const identityLinks: Record<string, string[]> = { ...config.session?.identityLinks };
    const entry = `${channel}:${peerId}`;
    const existing = identityLinks[canonical] ?? [];
    const filtered = existing.filter((e) => e !== entry);

    if (filtered.length === 0) {
      delete identityLinks[canonical];
    } else {
      identityLinks[canonical] = filtered;
    }

    const nextConfig: OpenClawConfig = {
      ...config,
      session: { ...config.session, identityLinks },
    };

    await writeConfigFile(nextConfig, writeOptions);

    // Re-read to get new hash
    const { snapshot: newSnap } = await readConfigFileSnapshotForWrite();
    const newHash = resolveConfigSnapshotHash(newSnap) ?? "";

    respond(true, { ok: true, configHash: newHash });
  },
};
