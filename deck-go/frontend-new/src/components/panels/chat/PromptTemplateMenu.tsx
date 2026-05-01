import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/design-system/atoms/Button";
import { DropdownMenu } from "@/design-system/atoms/DropdownMenu";

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
  const anchorRef = useRef<HTMLButtonElement>(null);

  const items = TEMPLATE_KEYS.map((key) => ({ id: key, label: t(key) }));

  return (
    <div className="ds-template-menu deck-ui-template-menu">
      <Button
        ref={anchorRef}
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {t("promptTemplates")}
      </Button>
      <DropdownMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        aria-label={t("promptTemplates")}
        items={items}
        onSelect={(id) => {
          onSelect(t(id as (typeof TEMPLATE_KEYS)[number]));
          setOpen(false);
        }}
      />
    </div>
  );
}
