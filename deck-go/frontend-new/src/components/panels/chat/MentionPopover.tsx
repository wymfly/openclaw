import { useTranslations } from "next-intl";
import { useAgentsStore } from "@/stores/agents";

export type MentionPopoverProps = {
  filter: string;
  onSelect: (agentName: string) => void;
  onDismiss: () => void;
};

export function MentionPopover({ filter, onSelect, onDismiss }: MentionPopoverProps) {
  const t = useTranslations("chat");
  const agents = useAgentsStore((state) => state.agents);
  const normalizedFilter = filter.toLowerCase();
  const filtered = agents.filter((agent) =>
    (agent.name || agent.id).toLowerCase().includes(normalizedFilter),
  );

  if (filtered.length === 0) {
    return null;
  }

  // Inline list (not anchored Popover) so the parent textarea owns dismissal +
  // keyboard nav (filtering via composer state). Visual matches bundle's
  // `mention-popover` floating panel — see chat-popover.css.
  return (
    <div
      className="ds-mention-popover deck-ui-mention-popover"
      role="listbox"
      aria-label={t("mentionAgents")}
    >
      <div className="ds-mention-popover__title deck-ui-mention-title">{t("mentionAgents")}</div>
      {filtered.map((agent) => {
        const label = agent.name || agent.id;
        return (
          <button
            className="ds-mention-popover__option deck-ui-mention-option"
            key={agent.id}
            type="button"
            onClick={() => {
              onSelect(label);
              onDismiss();
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
