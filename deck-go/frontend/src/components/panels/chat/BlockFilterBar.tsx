import { useTranslations } from "next-intl";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";

type BlockFilterKey = keyof Pick<
  ChatBlockPreferences,
  "showThinking" | "showToolUse" | "showToolResult"
>;

const TOGGLES: Array<{ key: BlockFilterKey; labelKey: string }> = [
  { key: "showThinking", labelKey: "filterThinking" },
  { key: "showToolUse", labelKey: "filterTools" },
  { key: "showToolResult", labelKey: "filterResults" },
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
      {TOGGLES.map(({ key, labelKey }) => {
        const enabled = preferences[key] ?? true;
        return (
          <button
            key={key}
            className={enabled ? "is-active" : ""}
            type="button"
            onClick={() => onChange({ ...preferences, [key]: !enabled })}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
