import { useTranslations } from "next-intl";
import { BrainIcon, CheckSquareIcon, WrenchIcon, type IconComponent } from "@/deck-ui/icons";
import { Chip } from "@/design-system/atoms/Chip";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";
import "./chat-widgets.css";

type BlockFilterKey = keyof Pick<
  ChatBlockPreferences,
  "showThinking" | "showToolUse" | "showToolResult"
>;

const TOGGLES: Array<{ key: BlockFilterKey; labelKey: string; icon: IconComponent }> = [
  { key: "showThinking", labelKey: "filterThinking", icon: BrainIcon },
  { key: "showToolUse", labelKey: "filterTools", icon: WrenchIcon },
  { key: "showToolResult", labelKey: "filterResults", icon: CheckSquareIcon },
];

export function BlockFilterBar({
  preferences,
  onChange,
}: {
  preferences: ChatBlockPreferences;
  onChange: (prefs: ChatBlockPreferences) => void;
}) {
  const t = useTranslations("chat");

  return (
    <div
      className="ds-block-filter-bar deck-ui-filter-row"
      role="toolbar"
      aria-label={t("filterBlocks")}
    >
      {TOGGLES.map(({ key, labelKey, icon: Icon }) => {
        const enabled = preferences[key] ?? true;
        const label = t(labelKey);
        return (
          <Chip
            key={key}
            active={enabled}
            role="button"
            tabIndex={0}
            aria-pressed={enabled}
            title={label}
            onClick={() => onChange({ ...preferences, [key]: !enabled })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange({ ...preferences, [key]: !enabled });
              }
            }}
          >
            <Icon />
            {label}
          </Chip>
        );
      })}
    </div>
  );
}
