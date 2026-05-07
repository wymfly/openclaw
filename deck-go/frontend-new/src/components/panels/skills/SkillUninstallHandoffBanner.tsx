import type { DeckGoSkillEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function SkillUninstallHandoffBanner(props: { skill: DeckGoSkillEntry }) {
  const t = useTranslations("skills");
  const reason = props.skill.unsupportedReasons?.uninstall ?? "gateway-rpc-missing";

  return (
    <div className="skills-panel__handoff-banner">
      <strong>{t("uninstallUnsupportedTitle")}</strong>
      <p>
        {t("uninstallUnsupportedBody")} <code>{reason}</code>
      </p>
    </div>
  );
}
