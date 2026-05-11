import type { DeckGoModelsConfigDetail } from "@/api-types";
import { Badge, Chip } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";

type ModelDefaults = NonNullable<DeckGoModelsConfigDetail["defaults"]>;
type PolicyKey = keyof ModelDefaults;
type ModelDefaultEntry = ModelDefaults[PolicyKey];

const POLICY_ROLES: Array<{ key: PolicyKey; labelKey: string }> = [
  { key: "text", labelKey: "text" },
  { key: "image", labelKey: "image" },
  { key: "imageGeneration", labelKey: "imageGeneration" },
  { key: "videoGeneration", labelKey: "videoGeneration" },
  { key: "musicGeneration", labelKey: "musicGeneration" },
  { key: "pdf", labelKey: "pdf" },
  { key: "summary", labelKey: "summary" },
  { key: "compaction", labelKey: "compaction" },
  { key: "memorySearch", labelKey: "memorySearch" },
  { key: "subagents", labelKey: "subagents" },
];

function modelRefLabel(ref: { provider?: string; model?: string } | undefined): string {
  if (!ref) {
    return "";
  }
  if (ref.provider && ref.model) {
    return `${ref.provider}/${ref.model}`;
  }
  return ref.model ?? ref.provider ?? "";
}

function hasPolicyEntry(entry: ModelDefaultEntry | undefined): boolean {
  if (!entry) {
    return false;
  }
  return Boolean(entry.provider || entry.model || (entry.fallbacks && entry.fallbacks.length > 0));
}

export interface UsagePolicyOverviewProps {
  detail: DeckGoModelsConfigDetail | undefined;
}

export function UsagePolicyOverview({ detail }: UsagePolicyOverviewProps) {
  const t = useTranslations("models");
  const entries = POLICY_ROLES.map((role) => ({
    ...role,
    entry: detail?.defaults?.[role.key],
  })).filter((role) => hasPolicyEntry(role.entry));

  return (
    <section className="models-policy" data-testid="models-usage-policy">
      <header className="models-policy-head">
        <div>
          <h3>{t("policy.title")}</h3>
          <p>{t("policy.description")}</p>
        </div>
        <Chip>{t("policy.owner")}</Chip>
      </header>
      {entries.length === 0 ? (
        <p className="models-policy-empty">{t("policy.empty")}</p>
      ) : (
        <ul className="models-policy-grid">
          {entries.map(({ key, labelKey, entry }) => {
            const primary = modelRefLabel(entry);
            const fallbacks = (entry?.fallbacks ?? []).map(modelRefLabel).filter(Boolean);
            return (
              <li key={key}>
                <div className="models-policy-row-head">
                  <span>{t(`policy.roles.${labelKey}`)}</span>
                  {entry?.source ? (
                    <Badge variant={entry.source === "explicit" ? "ok" : "neutral"}>
                      {t(`policy.source.${entry.source}`)}
                    </Badge>
                  ) : null}
                </div>
                <p>{primary || t("policy.unset")}</p>
                {fallbacks.length > 0 ? (
                  <small>{t("policy.fallbacks", { fallbacks: fallbacks.join(", ") })}</small>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
