import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
export type IconComponent = (props: IconProps) => React.JSX.Element;

function IconBase(props: IconProps) {
  const { children, ...rest } = props;
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="1em"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}

export function PanelCollapseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16" />
      <path d="M4 19h16" />
      <path d="M9 9l-3 3 3 3" />
      <path d="M14 9v6" />
      <path d="M18 9v6" />
    </IconBase>
  );
}

export function PanelExpandIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16" />
      <path d="M4 19h16" />
      <path d="M15 9l3 3-3 3" />
      <path d="M6 9v6" />
      <path d="M10 9v6" />
    </IconBase>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 4.5v15l12-7.5Z" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function SlashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 2 2 22" />
    </IconBase>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </IconBase>
  );
}

export function LoaderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.7-4" />
      <path d="M4 5v5h5" />
      <path d="M4 13a8 8 0 0 0 14.7 4" />
      <path d="M20 19v-5h-5" />
    </IconBase>
  );
}

export function RotateCcwIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.4 2.4L3 8" />
      <path d="M3 3v5h5" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3a6.8 6.8 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </IconBase>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="11" rx="2" width="16" x="4" y="5" />
      <path d="M8 21h8" />
      <path d="M12 16v5" />
    </IconBase>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </IconBase>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 21v-7" />
      <path d="M4 10V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-5" />
      <path d="M20 12V3" />
      <path d="M2 14h4" />
      <path d="M10 8h4" />
      <path d="M18 16h4" />
    </IconBase>
  );
}

export function SquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2" width="16" x="4" y="4" />
    </IconBase>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconBase>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </IconBase>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </IconBase>
  );
}

export function ArrowUpDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m7 15 5 5 5-5" />
      <path d="M12 20V4" />
      <path d="m7 9 5-5 5 5" />
    </IconBase>
  );
}

export function BarChartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-4" />
    </IconBase>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </IconBase>
  );
}

export function CheckSquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="16" rx="2" width="16" x="4" y="4" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m20 6-11 11-5-5" />
    </IconBase>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </IconBase>
  );
}

export function BotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="10" rx="2" width="14" x="5" y="9" />
      <path d="M12 5v4" />
      <path d="M9 14h.01" />
      <path d="M15 14h.01" />
      <path d="M8 19v2" />
      <path d="M16 19v2" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </IconBase>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 5a3 3 0 0 0-5 2.2A3.5 3.5 0 0 0 5 14a3 3 0 0 0 4 4" />
      <path d="M15 5a3 3 0 0 1 5 2.2A3.5 3.5 0 0 1 19 14a3 3 0 0 1-4 4" />
      <path d="M9 5v13" />
      <path d="M15 5v13" />
      <path d="M9 10H6" />
      <path d="M18 10h-3" />
    </IconBase>
  );
}

export function BugIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 2 1.9 2" />
      <path d="M14.1 4 16 2" />
      <path d="M9 9h6" />
      <path d="M7 13H3" />
      <path d="M21 13h-4" />
      <path d="M7 17H4" />
      <path d="M20 17h-3" />
      <path d="M12 20a5 5 0 0 0 5-5v-4a5 5 0 0 0-10 0v4a5 5 0 0 0 5 5Z" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </IconBase>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m18 15-6-6-6 6" />
    </IconBase>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="12" rx="2" width="12" x="6" y="6" />
      <path d="M9 1v3" />
      <path d="M15 1v3" />
      <path d="M9 20v3" />
      <path d="M15 20v3" />
      <path d="M20 9h3" />
      <path d="M20 15h3" />
      <path d="M1 9h3" />
      <path d="M1 15h3" />
    </IconBase>
  );
}

export function FileCodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </IconBase>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </IconBase>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </IconBase>
  );
}

export function MaximizeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </IconBase>
  );
}

export function FingerprintIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12a10 10 0 0 1 20 0" />
      <path d="M5 19.5a14 14 0 0 0 2-7.5 5 5 0 0 1 10 0" />
      <path d="M9 22a18 18 0 0 0 2-10 1 1 0 0 1 2 0 22 22 0 0 1-1.5 8" />
      <path d="M17 18a10 10 0 0 0 1-6" />
    </IconBase>
  );
}

export function GitBranchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 9v3a6 6 0 0 0 6 6h3" />
      <path d="M6 15V9" />
    </IconBase>
  );
}

export function MessageSquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </IconBase>
  );
}

export function MessagesSquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 10a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4z" />
      <path d="M8 14v2a4 4 0 0 0 4 4h5l4 3V13a4 4 0 0 0-4-4h-1" />
    </IconBase>
  );
}

export function MonitorDotIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="12" rx="2" width="18" x="3" y="4" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <circle cx="17" cy="9" r="1.5" />
    </IconBase>
  );
}

export function NavigationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m3 11 19-8-8 19-3-8-8-3Z" />
      <path d="m11 14 11-11" />
    </IconBase>
  );
}

export function NetworkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="6" rx="1" width="6" x="9" y="2" />
      <rect height="6" rx="1" width="6" x="3" y="16" />
      <rect height="6" rx="1" width="6" x="15" y="16" />
      <path d="M12 8v4" />
      <path d="M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </IconBase>
  );
}

export function ScrollTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 21h8a4 4 0 0 0 4-4V5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v12a4 4 0 0 0 4 4Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </IconBase>
  );
}

export function ServerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="8" rx="2" width="18" x="3" y="3" />
      <rect height="8" rx="2" width="18" x="3" y="13" />
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1A1.7 1.7 0 0 0 2.9 13H3a2 2 0 1 1 0-4h-.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.23.33.37.72.4 1.1H21a2 2 0 1 1 0 4h-.09c-.38.03-.77.17-1.1.4Z" />
    </IconBase>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </IconBase>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-5" />
    </IconBase>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7H5a2 2 0 0 1 0-4h12" />
      <path d="M20 7v14H5a2 2 0 0 1-2-2V5" />
      <path d="M16 13h.01" />
    </IconBase>
  );
}

export function WebhookIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 16.5a3.5 3.5 0 1 0-3.5-3.5" />
      <path d="M5 8a3.5 3.5 0 1 1 6.2 2.2" />
      <path d="M9.5 19a3.5 3.5 0 1 1 2-6.4" />
      <path d="M11 10.5 8.5 15" />
      <path d="M13 12.5h5" />
    </IconBase>
  );
}

export function WifiOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 8.8a15 15 0 0 1 4.3-2.5" />
      <path d="M10.4 4.2A15.5 15.5 0 0 1 22 8.8" />
      <path d="M5 13a10 10 0 0 1 5.2-2.8" />
      <path d="M14.2 10.3A10 10 0 0 1 19 13" />
      <path d="M8.5 17a5 5 0 0 1 7 0" />
      <path d="m2 2 20 20" />
    </IconBase>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3z" />
    </IconBase>
  );
}

export function ThumbsDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 14V3" />
      <path d="M7 10.5V3" />
      <path d="M7 10.5 4.4 10A2 2 0 0 1 3 8.1V5a2 2 0 0 1 2-2h10.7a2 2 0 0 1 1.9 1.4L20 11v3h-5.3a2 2 0 0 0-1.9 1.4L12 21h-1a2 2 0 0 1-2-2v-4.5Z" />
    </IconBase>
  );
}

export function ThumbsUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 10v11" />
      <path d="M17 10v11" />
      <path d="M7 10 9 4a2 2 0 0 1 2-1h1v6h5.3a2 2 0 0 1 1.9 2.6L17 18.5A2 2 0 0 1 15.1 20H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
    </IconBase>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 2 3 14h8l-1 8 11-14h-8z" />
    </IconBase>
  );
}
