import { useTranslations } from "next-intl";
import { useState } from "react";

type PromptTemplateMenuProps = {
  onSelect: (template: string) => void;
};

const TEMPLATE_KEYS = [
  "templateAnalyze",
  "templateExplain",
  "templateWrite",
  "templateDebug",
  "templateSummarize",
] as const;

export function PromptTemplateMenu({ onSelect }: PromptTemplateMenuProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);

  return (
    <div className="deck-ui-template-menu">
      <button type="button" onClick={() => setOpen((current) => !current)}>
        {t("promptTemplates")}
      </button>
      {open ? (
        <div
          className="deck-ui-template-menu-popover"
          role="menu"
          aria-label={t("promptTemplates")}
        >
          {TEMPLATE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(t(key));
                setOpen(false);
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
