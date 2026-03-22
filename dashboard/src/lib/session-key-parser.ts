export interface SessionKeySegment {
  label: string;
  value: string;
}

const KNOWN_CHANNELS = new Set([
  "telegram",
  "discord",
  "slack",
  "signal",
  "imessage",
  "web",
  "whatsapp",
  "wecom",
  "feishu",
  "msteams",
  "matrix",
  "line",
  "zalo",
]);

const KNOWN_TYPES = new Set(["direct", "group", "main"]);

export function parseSessionKey(key: string): SessionKeySegment[] {
  const parts = key.split(":");

  if (parts[0] !== "agent" || parts.length < 3) {
    return [{ label: "Key", value: key }];
  }

  const agentId = parts[1];
  const rest = parts.slice(2);
  const segments: SessionKeySegment[] = [{ label: "Agent", value: agentId }];

  if (rest.length === 1) {
    // agent:id:main → Scope
    segments.push({ label: "Scope", value: rest[0] });
  } else if (rest.length === 2 && KNOWN_TYPES.has(rest[0])) {
    // agent:id:direct:user123 → Type + Peer
    segments.push({ label: "Type", value: rest[0] });
    segments.push({ label: "Peer", value: rest[1] });
  } else if (rest.length >= 2 && KNOWN_CHANNELS.has(rest[0])) {
    const channel = rest[0];
    const afterChannel = rest.slice(1);
    segments.push({ label: "Channel", value: channel });

    if (afterChannel.length === 1) {
      // agent:id:telegram:user123 → Channel + Peer
      segments.push({ label: "Peer", value: afterChannel[0] });
    } else if (KNOWN_TYPES.has(afterChannel[0])) {
      // agent:id:telegram:direct:user123 → Channel + Type + Peer
      segments.push({ label: "Type", value: afterChannel[0] });
      segments.push({ label: "Peer", value: afterChannel.slice(1).join(":") });
    } else if (afterChannel.length >= 2 && KNOWN_TYPES.has(afterChannel[1])) {
      // agent:id:wecom:acct1:direct:user123 → Channel + Account + Type + Peer
      segments.push({ label: "Account", value: afterChannel[0] });
      segments.push({ label: "Type", value: afterChannel[1] });
      segments.push({ label: "Peer", value: afterChannel.slice(2).join(":") });
    } else {
      // fallback: Channel + Scope
      segments.push({ label: "Scope", value: afterChannel.join(":") });
    }
  } else {
    // unknown format fallback
    segments.push({ label: "Scope", value: rest.join(":") });
  }

  return segments;
}
