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
const IconMinus = (p) => <Icon d="M5 12h14" {...p} />;
const IconLink = (p) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </Icon>
);
const IconUnlink = (p) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l1-1" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-1 1" />
    <path d="M3 3l18 18" />
  </Icon>
);
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
const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);
const IconChevron = (p) => <Icon d="M9 18l6-6-6-6" {...p} />;
const IconHash = (p) => <Icon d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" {...p} />;
const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
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
const IconCopy = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icon>
);
const IconTelegram = (p) => (
  <Icon {...p} viewBox="0 0 24 24" stroke={1.4}>
    <path d="M21.5 4.2 2.6 11.4c-.8.3-.8 1.4 0 1.6l4.7 1.6 1.7 5.6c.2.6 1 .8 1.5.3l2.5-2.4 4.6 3.4c.7.5 1.6.1 1.8-.7l3.3-15.5c.2-.9-.7-1.6-1.5-1.1Z" />
    <path d="m9 14 8-7-6 8" />
  </Icon>
);
const IconDiscord = (p) => (
  <Icon {...p} viewBox="0 0 24 24" stroke={1.4}>
    <path d="M19 5.5A14 14 0 0 0 15 4l-.4.7a13 13 0 0 0-5.2 0L9 4a14 14 0 0 0-4 1.5C2 9 1.5 13 2 17c1.6 1.2 3.6 2 5.6 2.5l.8-1.4c-.7-.2-1.4-.5-2-1l.5-.4a8 8 0 0 0 10.2 0l.5.4c-.6.5-1.3.8-2 1l.8 1.4c2-.5 4-1.3 5.6-2.5.5-4-.5-8-2-11.5Z" />
    <circle cx="9" cy="13" r="1.3" />
    <circle cx="15" cy="13" r="1.3" />
  </Icon>
);
const IconSlack = (p) => (
  <Icon {...p}>
    <rect x="3" y="9" width="6" height="3" rx="1.5" />
    <rect x="3" y="14" width="3" height="6" rx="1.5" />
    <rect x="9" y="3" width="3" height="6" rx="1.5" />
    <rect x="14" y="3" width="6" height="3" rx="1.5" />
    <rect x="18" y="9" width="3" height="6" rx="1.5" />
    <rect x="14" y="18" width="6" height="3" rx="1.5" />
    <rect x="9" y="14" width="6" height="3" rx="1.5" />
  </Icon>
);
const IconWecom = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="5" />
    <circle cx="15" cy="15" r="4.5" />
    <path d="M14 8.5h.01M11 12.5h.01" />
  </Icon>
);
const IconMail = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
);

const ChannelIcon = ({ channel, ...rest }) => {
  if (channel === "telegram") return <IconTelegram {...rest} />;
  if (channel === "discord") return <IconDiscord {...rest} />;
  if (channel === "slack") return <IconSlack {...rest} />;
  if (channel === "wecom") return <IconWecom {...rest} />;
  if (channel === "email") return <IconMail {...rest} />;
  return <IconHash {...rest} />;
};

const ChannelPill = ({ channel, label }) => (
  <span className={`channel-pill channel-pill--${channel}`}>
    <ChannelIcon channel={channel} size={12} />
    <span>{label || channel}</span>
  </span>
);

const StatusPill = ({ tone = "iron", icon: IconC, children }) => (
  <span className={`status-pill status-pill--${tone}`}>
    {IconC ? <IconC size={11} /> : null}
    <span>{children}</span>
  </span>
);

const HashChip = ({ value, tone = "iron", label = "hash" }) => (
  <span className={`hash-chip hash-chip--${tone}`} title={`${label}: ${value}`}>
    <IconHash size={10} />
    <span>{value}</span>
  </span>
);

const ActorChip = ({ actor }) => {
  const isAuto = actor && actor.startsWith("automation:");
  const isSystem = actor === "system";
  const tone = isSystem ? "iron" : isAuto ? "accent" : "success";
  const Icn = isSystem ? IconShield : isAuto ? IconShield : IconUser;
  return (
    <span className={`actor-chip actor-chip--${tone}`} title={actor}>
      <Icn size={11} />
      <span>{actor}</span>
    </span>
  );
};

Object.assign(window, {
  Icon,
  IconRefresh,
  IconPlus,
  IconMinus,
  IconLink,
  IconUnlink,
  IconEdit,
  IconTrash,
  IconClose,
  IconCheck,
  IconAlert,
  IconSearch,
  IconChevron,
  IconHash,
  IconClock,
  IconUser,
  IconUsers,
  IconShield,
  IconCopy,
  IconTelegram,
  IconDiscord,
  IconSlack,
  IconWecom,
  IconMail,
  ChannelIcon,
  ChannelPill,
  StatusPill,
  HashChip,
  ActorChip,
});
