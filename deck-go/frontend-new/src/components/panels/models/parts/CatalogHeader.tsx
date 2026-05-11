import type { DeckGoModelCatalogMode, DeckGoModelsConfigDetail } from "@/api-types";
import { Badge, type BadgeVariant, Button, Chip } from "@/design-system/atoms";
import { IconPlus, IconRefresh } from "@/design-system/icons";
import { useTranslations } from "@/i18n/provider";
import { describeMode, describeRuntime, totalConfiguredModels } from "../lib/models-selectors";

export interface CatalogHeaderProps {
  detail: DeckGoModelsConfigDetail | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAddProvider: () => void;
  onChangeMode: (mode: DeckGoModelCatalogMode) => void;
  modeBusy: boolean;
}

function catalogBadgeVariant(status: "available" | "stale" | "unavailable"): BadgeVariant {
  if (status === "available") {
    return "ok";
  }
  if (status === "stale") {
    return "warn";
  }
  return "neutral";
}

function authBadgeVariant(status: "available" | "unavailable"): BadgeVariant {
  return status === "available" ? "ok" : "neutral";
}

export function CatalogHeader(props: CatalogHeaderProps) {
  const t = useTranslations("models");
  const detail = props.detail;
  const mode: DeckGoModelCatalogMode = describeMode(detail?.mode);
  const providerCount = detail?.providers.length ?? 0;
  const modelsCount = totalConfiguredModels(detail);
  const runtime = detail
    ? describeRuntime(detail.runtime)
    : {
        catalog: "unavailable" as const,
        auth: "unavailable" as const,
        probe: "unavailable" as const,
        catalogCount: 0,
        authCount: 0,
      };

  return (
    <header className="models-header" data-testid="models-catalog-header">
      <div className="models-header-row">
        <div className="models-header-title">
          <h2>{t("title")}</h2>
          <span className="models-header-mode" data-mode={mode}>
            {t(`mode.${mode}Label`)}
            <small>{t("mode.rawValue", { value: mode })}</small>
          </span>
        </div>
        <div className="models-header-actions">
          <Button variant="ghost" size="sm" onClick={props.onRefresh} disabled={props.isRefreshing}>
            <IconRefresh size={14} aria-hidden />
            {props.isRefreshing ? t("status.refreshing") : t("status.refresh")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={props.onAddProvider}
            disabled={props.isLoading}
          >
            <IconPlus size={14} aria-hidden />
            {t("actions.addProvider")}
          </Button>
        </div>
      </div>
      <div className="models-header-meta">
        <Chip>
          {t("status.providers")} {providerCount}
        </Chip>
        <Chip>
          {t("status.modelsLabel")} {modelsCount}
        </Chip>
        <Chip>
          {t("status.catalogProvidersLabel")} {runtime.catalogCount}
          <Badge variant={catalogBadgeVariant(runtime.catalog)}>
            {t(`runtime.catalog.${runtime.catalog}`)}
          </Badge>
        </Chip>
        <Chip>
          {t("status.authProvidersLabel")} {runtime.authCount}
          <Badge variant={authBadgeVariant(runtime.auth)}>
            {t(`runtime.auth.${runtime.auth}`)}
          </Badge>
        </Chip>
      </div>
      {mode === "replace" ? (
        <div className="models-header-policy" role="status">
          <p>{t("mode.replaceWarning")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onChangeMode("merge")}
            disabled={props.modeBusy}
          >
            {t("mode.restoreMerge")}
          </Button>
        </div>
      ) : null}
      <p className="models-header-mode-help">{t(`mode.${mode}Help`)}</p>
    </header>
  );
}
