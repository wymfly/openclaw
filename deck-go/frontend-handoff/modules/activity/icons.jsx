// SVG icon set for activity prototype.

const _iconBase = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconSearch(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IconRefresh(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
function IconCheck(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}
function IconX(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}
function IconAlert(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4 2 20h20z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
function IconInfo(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  );
}
function IconErrorCircle(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
}
function IconClock(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconActivity(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}
function IconAgent(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <path d="M12 3v3" />
    </svg>
  );
}
function IconBranch(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="19" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v10" />
      <path d="M6 11h6a4 4 0 0 1 4 4v2" />
    </svg>
  );
}
function IconChevronDown(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function IconChevronRight(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function IconTool(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="m14 7 3 3-7 7H7v-3z" />
      <path d="m17 4 3 3-2 2-3-3z" />
    </svg>
  );
}
function IconShield(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z" />
    </svg>
  );
}
function IconChannel(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M4 4v16l5-4h11V4z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
    </svg>
  );
}
function IconKey(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 9-9" />
      <path d="m17 5 3 3" />
    </svg>
  );
}
function IconKbd(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 11h.01M11 11h.01M15 11h.01M7 15h10" />
    </svg>
  );
}
function IconMessage(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M4 4v12l4-4h12V4z" />
    </svg>
  );
}
function IconArrowDown(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4v16" />
      <path d="m6 14 6 6 6-6" />
    </svg>
  );
}
function IconArrowUp(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 20V4" />
      <path d="m18 10-6-6-6 6" />
    </svg>
  );
}
function IconStop(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function IconTarget(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}
function IconPower(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <path d="M12 4v8" />
      <path d="M7.8 7.8a6 6 0 1 0 8.4 0" />
    </svg>
  );
}
function IconCopy(p = {}) {
  return (
    <svg {..._iconBase} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

// EventGlyph — colored type-anchored icon. The dot color encodes severity
// (info / warn / err / muted), the icon shape encodes event family.
const TYPE_FAMILY = {
  "agent.start": { Icon: IconPower, severity: "info" },
  "agent.stop": { Icon: IconPower, severity: "muted" },
  "agent.error": { Icon: IconErrorCircle, severity: "err" },
  "agent.handoff": { Icon: IconArrowUp, severity: "info" },
  "tool.call": { Icon: IconTool, severity: "info" },
  "tool.result": { Icon: IconCheck, severity: "ok" },
  "tool.deny": { Icon: IconShield, severity: "warn" },
  "message.in": { Icon: IconMessage, severity: "info" },
  "message.out": { Icon: IconArrowUp, severity: "info" },
  "subagent.spawn": { Icon: IconBranch, severity: "info" },
  "subagent.kill": { Icon: IconStop, severity: "warn" },
  "subagent.steer": { Icon: IconTarget, severity: "info" },
  "channel.connect": { Icon: IconChannel, severity: "ok" },
  "channel.disconnect": { Icon: IconChannel, severity: "warn" },
  "channel.error": { Icon: IconChannel, severity: "err" },
  "config.change": { Icon: IconArrowDown, severity: "info" },
  "auth.rotate": { Icon: IconKey, severity: "info" },
  "alert.fire": { Icon: IconAlert, severity: "warn" },
  "approval.request": { Icon: IconShield, severity: "info" },
  "approval.grant": { Icon: IconCheck, severity: "ok" },
  "approval.deny": { Icon: IconX, severity: "err" },
};

function EventGlyph({ type }) {
  const meta = TYPE_FAMILY[type] || { Icon: IconActivity, severity: "muted" };
  const { Icon, severity } = meta;
  return (
    <div className={`event-glyph event-glyph--${severity}`} aria-hidden="true">
      <Icon />
    </div>
  );
}

function eventSeverity(type) {
  return TYPE_FAMILY[type]?.severity || "muted";
}

const AGENT_PALETTES = {
  main: "linear-gradient(135deg, #1f3a5f 0%, #6aa9ff 100%)",
  executor: "linear-gradient(135deg, #1f4a3f 0%, #5fb09a 100%)",
  architect: "linear-gradient(135deg, #4a3520 0%, #d39256 100%)",
  critic: "linear-gradient(135deg, #4a2030 0%, #d3568f 100%)",
  verifier: "linear-gradient(135deg, #2a1f4a 0%, #8c6ad3 100%)",
  explore: "linear-gradient(135deg, #1f4a4a 0%, #5fc3c3 100%)",
  scientist: "linear-gradient(135deg, #4a4520 0%, #d3c356 100%)",
  tracer: "linear-gradient(135deg, #20203a 0%, #5670ff 100%)",
  writer: "linear-gradient(135deg, #2a3a1f 0%, #82c350 100%)",
  designer: "linear-gradient(135deg, #4a2050 0%, #c356d3 100%)",
  "test-engineer": "linear-gradient(135deg, #1f4a3f 0%, #50a395 100%)",
};
function AgentChip({ agentId, agentName }) {
  if (!agentId) return null;
  const initial = (agentName || agentId).charAt(0).toUpperCase();
  const palette = AGENT_PALETTES[agentId] || "linear-gradient(135deg, #2a2f3a 0%, #4a5160 100%)";
  return (
    <span className="agent-chip">
      <span className="agent-chip__avatar" style={{ background: palette }}>
        {initial}
      </span>
      <span>{agentName || agentId}</span>
    </span>
  );
}

Object.assign(window, {
  IconSearch,
  IconRefresh,
  IconCheck,
  IconX,
  IconAlert,
  IconInfo,
  IconErrorCircle,
  IconClock,
  IconActivity,
  IconAgent,
  IconBranch,
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconShield,
  IconChannel,
  IconKey,
  IconKbd,
  IconMessage,
  IconArrowDown,
  IconArrowUp,
  IconStop,
  IconTarget,
  IconPower,
  IconCopy,
  EventGlyph,
  eventSeverity,
  AgentChip,
  TYPE_FAMILY,
});
