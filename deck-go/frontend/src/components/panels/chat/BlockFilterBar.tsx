import { useTranslations } from "next-intl";
import { BrainIcon, CheckSquareIcon, WrenchIcon, type IconComponent } from "@/deck-ui/icons";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";

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
    <div className="deck-ui-filter-row" aria-label={t("filterBlocks")}>
      {TOGGLES.map(({ key, labelKey, icon: Icon }) => {
        const enabled = preferences[key] ?? true;
        const label = t(labelKey);
        return (
          <button
            key={key}
            aria-pressed={enabled}
            className={enabled ? "is-active" : ""}
            title={label}
            type="button"
            onClick={() => onChange({ ...preferences, [key]: !enabled })}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </div>
  );
}
