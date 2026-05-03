/* deck-go threads prototype v2 — icons + channel/target glyphs */

const icon = (path) =>
  function Icon({ size = 14, strokeWidth = 1.6, className }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };

const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3" />
  </>,
);
const IconRefresh = icon(
  <>
    <path d="M21 12a9 9 0 0 1-15.46 6.36L3 16" />
    <path d="M3 12a9 9 0 0 1 15.46-6.36L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M3 21v-5h5" />
  </>,
);
const IconClose = icon(
  <>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </>,
);
const IconChevronLeft = icon(<path d="m15 6-6 6 6 6" />);
const IconChevronRight = icon(<path d="m9 6 6 6-6 6" />);
const IconLink = icon(
  <>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </>,
);
const IconUnlink = icon(
  <>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    <path d="m4 4 16 16" />
  </>,
);
const IconArrowOut = icon(
  <>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </>,
);
const IconUser = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </>,
);
const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
const IconTag = icon(
  <>
    <path d="M3 12 12 3h7v7l-9 9-7-7Z" />
    <circle cx="15" cy="9" r="1.4" />
  </>,
);
const IconTerminal = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m6 10 3 2-3 2" />
    <path d="M12 14h6" />
  </>,
);
const IconLoop = icon(
  <>
    <path d="M5 12a7 7 0 0 1 12-5" />
    <path d="M19 12a7 7 0 0 1-12 5" />
    <path d="m17 4 0 4-4 0" />
    <path d="m7 20 0-4 4 0" />
  </>,
);
const IconBot = icon(
  <>
    <rect x="4" y="7" width="16" height="13" rx="3" />
    <circle cx="9" cy="13" r="1.5" />
    <circle cx="15" cy="13" r="1.5" />
    <path d="M12 4v3" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
  </>,
);
const IconChat = icon(
  <>
    <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" />
  </>,
);
const IconChannelDiscord = icon(
  <>
    <path d="M5 7c2-2 5-2 7-2s5 0 7 2c1.6 1.6 2 5.5 2 8 0 2-3 4-5 4l-1-2" />
    <path d="M5 19c-2 0-5-2-5-4 0-2.5.4-6.4 2-8" />
    <circle cx="9" cy="13" r="1.4" />
    <circle cx="15" cy="13" r="1.4" />
  </>,
);
const IconChannelTelegram = icon(
  <>
    <path d="m3 11 18-7-3 16-7-4-3 4z" />
    <path d="m11 16 5-5" />
  </>,
);
const IconChannelWecom = icon(
  <>
    <circle cx="9" cy="11" r="5" />
    <circle cx="16" cy="14" r="3.5" />
    <path d="M5 10c2-1 6 1 8 0" />
    <path d="M14 14h3" />
  </>,
);
const IconChannelSlack = icon(
  <>
    <rect x="4" y="9" width="6" height="2" rx="1" />
    <rect x="14" y="13" width="6" height="2" rx="1" />
    <rect x="9" y="14" width="2" height="6" rx="1" />
    <rect x="13" y="4" width="2" height="6" rx="1" />
  </>,
);
const IconChannelQq = icon(
  <>
    <ellipse cx="12" cy="11" rx="6" ry="7" />
    <circle cx="9.5" cy="10.5" r="1" />
    <circle cx="14.5" cy="10.5" r="1" />
    <path d="M8 19l-2 3M16 19l2 3" />
  </>,
);
const IconActivity = icon(<path d="M3 12h4l2-7 4 14 2-7h6" />);
const IconAudit = icon(
  <>
    <path d="M5 4h11l3 3v13a2 2 0 0 1-2 2H5z" />
    <path d="M9 12h7" />
    <path d="M9 16h5" />
    <path d="M9 8h4" />
  </>,
);
const IconCheck = icon(<path d="m5 12 5 5L20 7" />);
const IconAlert = icon(
  <>
    <path d="M12 3 2 21h20z" />
    <path d="M12 9v5" />
    <path d="M12 17h0" />
  </>,
);

const CHANNEL_META = {
  discord: { label: "Discord", glyph: IconChannelDiscord, tone: "violet" },
  telegram: { label: "Telegram", glyph: IconChannelTelegram, tone: "accent" },
  wecom: { label: "WeCom", glyph: IconChannelWecom, tone: "success" },
  slack: { label: "Slack", glyph: IconChannelSlack, tone: "magenta" },
  qq: { label: "QQ", glyph: IconChannelQq, tone: "amber" },
};

const TARGET_KIND_META = {
  "claude-code-session": { label: "Claude Code", Icon: IconTerminal, tone: "accent" },
  "agent-loop": { label: "Agent loop", Icon: IconLoop, tone: "violet" },
  "external-bot": { label: "External bot", Icon: IconBot, tone: "amber" },
};

const ACTIVITY_KIND_META = {
  "tool.call": { label: "tool", tone: "accent" },
  "model.call": { label: "model", tone: "violet" },
  "channel.inbound": { label: "← in", tone: "success" },
  "channel.outbound": { label: "→ out", tone: "warm" },
  "agent.handoff": { label: "handoff", tone: "magenta" },
};

function ChannelTile({ channelKind, channelId, dense = false }) {
  const meta = CHANNEL_META[channelKind] ?? {
    label: channelKind,
    glyph: IconChat,
    tone: "iron",
  };
  const Glyph = meta.glyph;
  return (
    <span
      className={`channel-tile channel-tile--${meta.tone}${dense ? " channel-tile--dense" : ""}`}
    >
      <span className="channel-tile__glyph" aria-hidden="true">
        <Glyph size={dense ? 12 : 14} />
      </span>
      <span className="channel-tile__body">
        <span className="channel-tile__label">{meta.label}</span>
        {channelId && (
          <span className="channel-tile__id">
            {channelId.split(":").slice(1).join(":") || channelId}
          </span>
        )}
      </span>
    </span>
  );
}

function TargetKindPill({ kind }) {
  const meta = TARGET_KIND_META[kind] ?? {
    label: kind,
    Icon: IconBot,
    tone: "iron",
  };
  const Icon = meta.Icon;
  return (
    <span className={`target-pill target-pill--${meta.tone}`}>
      <Icon size={11} />
      <span>{meta.label}</span>
    </span>
  );
}

function ActivityKindBadge({ kind }) {
  const meta = ACTIVITY_KIND_META[kind] ?? { label: kind, tone: "iron" };
  return <span className={`activity-badge activity-badge--${meta.tone}`}>{meta.label}</span>;
}

Object.assign(window, {
  IconSearch,
  IconRefresh,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconUnlink,
  IconArrowOut,
  IconUser,
  IconClock,
  IconTag,
  IconTerminal,
  IconLoop,
  IconBot,
  IconChat,
  IconActivity,
  IconAudit,
  IconCheck,
  IconAlert,
  IconChannelDiscord,
  IconChannelTelegram,
  IconChannelWecom,
  IconChannelSlack,
  IconChannelQq,
  CHANNEL_META,
  TARGET_KIND_META,
  ACTIVITY_KIND_META,
  ChannelTile,
  TargetKindPill,
  ActivityKindBadge,
});
