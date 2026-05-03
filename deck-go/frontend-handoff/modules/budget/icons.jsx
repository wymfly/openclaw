/* global React */
const Icon = ({ d, size = 16, stroke = 1.5, viewBox = "0 0 24 24", children }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const IconRefresh = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 1 3 6.7" />
    <path d="M3 21v-6h6" />
  </Icon>
);
const IconPlus = (p) => <Icon d="M12 5v14M5 12h14" {...p} />;
const IconEdit = (p) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
);
const IconTrash = (p) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
  </Icon>
);
const IconClose = (p) => <Icon d="M18 6 6 18M6 6l12 12" {...p} />;
const IconCheck = (p) => <Icon d="M5 13l4 4L19 7" {...p} />;
const IconAlert = (p) => (
  <Icon {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </Icon>
);
const IconBolt = (p) => <Icon d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" {...p} />;
const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
const IconCoin = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9h5a2.5 2.5 0 0 1 0 5H9M9 14h6" />
  </Icon>
);
const IconArrowDown = (p) => <Icon d="M12 5v14M5 12l7 7 7-7" {...p} />;
const IconArrowUp = (p) => <Icon d="M12 19V5M5 12l7-7 7 7" {...p} />;
const IconSigma = (p) => <Icon d="M19 5H5l7 7-7 7h14" {...p} />;
const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);
const IconUser = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);
const IconUsers = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M14 18a5 5 0 0 1 8 2" />
  </Icon>
);
const IconShield = (p) => (
  <Icon {...p}>
    <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6Z" />
  </Icon>
);
const IconHash = (p) => <Icon d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" {...p} />;
const IconPower = (p) => (
  <Icon {...p}>
    <path d="M12 2v10M5.6 7.6a8 8 0 1 0 12.8 0" />
  </Icon>
);
const IconChevron = (p) => <Icon d="M9 18l6-6-6-6" {...p} />;

const DimensionIcon = ({ dimension, ...rest }) => {
  if (dimension === "cost") return <IconCoin {...rest} />;
  if (dimension === "tokensIn") return <IconArrowDown {...rest} />;
  if (dimension === "tokensOut") return <IconArrowUp {...rest} />;
  if (dimension === "totalTokens") return <IconSigma {...rest} />;
  return <IconBolt {...rest} />;
};

const DimensionPill = ({ dimension }) => {
  const labels = {
    cost: "USD cost",
    tokensIn: "Tokens in",
    tokensOut: "Tokens out",
    totalTokens: "Total tokens",
  };
  return (
    <span className={`dim-pill dim-pill--${dimension}`}>
      <DimensionIcon dimension={dimension} size={11} />
      <span>{labels[dimension] || dimension}</span>
    </span>
  );
};

const StatusPill = ({ tone = "iron", icon: IconC, children }) => (
  <span className={`status-pill status-pill--${tone}`}>
    {IconC ? <IconC size={11} /> : null}
    <span>{children}</span>
  </span>
);

const BudgetStatusPill = ({ status }) => {
  if (status === "ok")
    return (
      <StatusPill tone="success" icon={IconCheck}>
        ok
      </StatusPill>
    );
  if (status === "warn")
    return (
      <StatusPill tone="warn" icon={IconAlert}>
        warn
      </StatusPill>
    );
  return (
    <StatusPill tone="error" icon={IconAlert}>
      over
    </StatusPill>
  );
};

const ScopeChip = ({ scope, agentId, taskId }) => {
  let label = scope;
  let icon = IconShield;
  if (scope === "agent" && agentId) {
    label = `agent:${agentId}`;
    icon = IconUser;
  } else if (scope === "task" && taskId) {
    label = `task:${taskId}`;
    icon = IconUsers;
  } else if (scope === "channel") {
    label = "channel";
    icon = IconHash;
  } else if (scope === "global") {
    label = "global";
    icon = IconShield;
  } else if (scope === "workspace") {
    label = "workspace";
    icon = IconShield;
  }
  const Ic = icon;
  return (
    <span className={`scope-chip scope-chip--${scope}`} title={label}>
      <Ic size={11} />
      <span>{label}</span>
    </span>
  );
};

const PeriodChip = ({ period }) => (
  <span className={`period-chip period-chip--${period}`}>
    <IconClock size={11} />
    <span>per {period}</span>
  </span>
);

const ActorChip = ({ actor }) => {
  const isAuto = actor && actor.startsWith("automation:");
  const isSystem = actor === "system";
  const tone = isSystem ? "iron" : isAuto ? "accent" : "success";
  return (
    <span className={`actor-chip actor-chip--${tone}`} title={actor}>
      <span>{actor}</span>
    </span>
  );
};

const ThresholdMeter = ({ current, warn, over }) => {
  const max = over * 1.15 || warn * 1.5 || 1;
  const pctCurrent = Math.min(100, (current / max) * 100);
  const pctWarn = Math.min(100, (warn / max) * 100);
  const pctOver = Math.min(100, (over / max) * 100);
  const fillTone = current >= over ? "error" : current >= warn ? "warn" : "success";
  return (
    <div className="threshold-meter">
      <div className="threshold-meter__track">
        <div
          className={`threshold-meter__fill threshold-meter__fill--${fillTone}`}
          style={{ width: `${pctCurrent}%` }}
        />
        <div
          className="threshold-meter__tick threshold-meter__tick--warn"
          style={{ left: `${pctWarn}%` }}
          title={`warn at ${warn}`}
        />
        <div
          className="threshold-meter__tick threshold-meter__tick--over"
          style={{ left: `${pctOver}%` }}
          title={`over at ${over}`}
        />
      </div>
    </div>
  );
};

Object.assign(window, {
  Icon,
  IconRefresh,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCheck,
  IconAlert,
  IconBolt,
  IconClock,
  IconCoin,
  IconArrowDown,
  IconArrowUp,
  IconSigma,
  IconSearch,
  IconUser,
  IconUsers,
  IconShield,
  IconHash,
  IconPower,
  IconChevron,
  DimensionIcon,
  DimensionPill,
  StatusPill,
  BudgetStatusPill,
  ScopeChip,
  PeriodChip,
  ActorChip,
  ThresholdMeter,
});
