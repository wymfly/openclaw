/**
 * Flat-key → nested schema compatibility adapter.
 *
 * Maps configuration keys used by other WeCom plugins (official, @sunnoy, etc.)
 * to the nested structure expected by @yanhaidao/wecom.
 *
 * Flat key mapping:
 *   botId           → bot.ws.botId
 *   secret          → bot.ws.secret
 *   dmPolicy        → bot.dm.policy
 *   allowFrom       → bot.dm.allowFrom
 *   groupPolicy     → dynamicAgents.groupEnabled  (open/allowlist→true, disabled→false)
 *   welcomeMessage  → bot.welcomeText
 *   groupAllowFrom  → (unsupported, warn)
 *   websocketUrl    → (unsupported, warn)
 *
 * Nested keys always take precedence over flat keys.
 */

/** Known flat keys that map to nested paths. */
const FLAT_KEYS = [
  "botId",
  "secret",
  "dmPolicy",
  "allowFrom",
  "groupPolicy",
  "groupAllowFrom",
  "websocketUrl",
  "welcomeMessage",
  "sendThinkingMessage",
] as const;

type FlatKey = (typeof FLAT_KEYS)[number];

interface CompatLogger {
  warn?: (message: string) => void;
}

/**
 * Accept a raw config object that may contain flat keys (from other plugins)
 * and return a config object in @yanhaidao's nested structure.
 *
 * Flat keys are consumed (removed from output). Nested keys take precedence.
 */
export function applyFlatKeyCompat(
  raw: Record<string, unknown>,
  log?: CompatLogger,
): Record<string, unknown> {
  const warn = log?.warn ?? (() => {});

  // Separate flat keys from the rest
  const rest: Record<string, unknown> = {};
  const flat: Partial<Record<FlatKey, unknown>> = {};

  for (const [key, value] of Object.entries(raw)) {
    if ((FLAT_KEYS as readonly string[]).includes(key) && value !== undefined) {
      flat[key as FlatKey] = value;
    } else {
      rest[key] = value;
    }
  }

  // If no flat keys found, return as-is
  if (Object.keys(flat).length === 0) {
    return rest;
  }

  // Build nested bot config from flat keys
  const existingBot = (rest.bot ?? {}) as Record<string, unknown>;

  // bot.ws
  const existingWs = (existingBot.ws ?? {}) as Record<string, unknown>;
  const ws: Record<string, unknown> = { ...existingWs };
  if (flat.botId !== undefined && existingWs.botId === undefined) {
    ws.botId = flat.botId;
  }
  if (flat.secret !== undefined && existingWs.secret === undefined) {
    ws.secret = flat.secret;
  }

  // bot.dm
  const existingDm = (existingBot.dm ?? {}) as Record<string, unknown>;
  const dm: Record<string, unknown> = { ...existingDm };
  if (flat.dmPolicy !== undefined && existingDm.policy === undefined) {
    dm.policy = flat.dmPolicy;
  }
  if (flat.allowFrom !== undefined && existingDm.allowFrom === undefined) {
    dm.allowFrom = flat.allowFrom;
  }

  // bot.welcomeText
  let welcomeText = existingBot.welcomeText as string | undefined;
  if (flat.welcomeMessage !== undefined && welcomeText === undefined) {
    welcomeText = flat.welcomeMessage as string;
  }

  // bot.streamPlaceholderContent (sendThinkingMessage boolean → placeholder)
  let streamPlaceholderContent = existingBot.streamPlaceholderContent as string | undefined;
  if (flat.sendThinkingMessage !== undefined && streamPlaceholderContent === undefined) {
    streamPlaceholderContent = flat.sendThinkingMessage ? "正在思考中..." : undefined;
  }

  // Assemble bot only if there are meaningful keys
  const hasWsKeys = Object.keys(ws).length > 0;
  const hasDmKeys = Object.keys(dm).length > 0;
  const hasBotKeys = hasWsKeys || hasDmKeys || welcomeText || streamPlaceholderContent;

  if (hasBotKeys) {
    const bot: Record<string, unknown> = { ...existingBot };
    if (hasWsKeys) bot.ws = ws;
    if (hasDmKeys) bot.dm = dm;
    if (welcomeText !== undefined) bot.welcomeText = welcomeText;
    if (streamPlaceholderContent !== undefined)
      bot.streamPlaceholderContent = streamPlaceholderContent;
    rest.bot = bot;
  }

  // dynamicAgents.groupEnabled from groupPolicy
  if (flat.groupPolicy !== undefined) {
    const existingDynamic = (rest.dynamicAgents ?? {}) as Record<string, unknown>;
    if (existingDynamic.groupEnabled === undefined) {
      rest.dynamicAgents = {
        ...existingDynamic,
        groupEnabled: flat.groupPolicy !== "disabled",
      };
    }
  }

  // Warn about unsupported flat keys
  if (flat.groupAllowFrom !== undefined) {
    warn(
      "[wecom-compat] groupAllowFrom is not supported in @yanhaidao schema; per-group allowlists should be configured via dynamicAgents",
    );
  }
  if (flat.websocketUrl !== undefined) {
    warn(
      "[wecom-compat] websocketUrl is not supported; @yanhaidao uses the SDK default WebSocket endpoint",
    );
  }

  return rest;
}
