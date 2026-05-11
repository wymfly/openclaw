import type { DeckGoModelEntry } from "@/api-types";
import { Badge, Chip } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { modelInputsLabel, modelUsageRelations, modelUsageRoles } from "../lib/models-selectors";

export interface ModelRowProps {
  providerId: string;
  model: DeckGoModelEntry;
  onOpen: (modelId: string) => void;
  onPreviewDelete: (modelId: string) => void;
}

export function ModelRow({ providerId, model, onOpen, onPreviewDelete }: ModelRowProps) {
  const t = useTranslations("models");
  const relations = new Set(modelUsageRelations(model));
  const roles = modelUsageRoles(model);
  return (
    <li
      className="models-row"
      data-testid={`models-row-${providerId}-${model.id}`}
      data-referenced={model.isReferenced || undefined}
    >
      <button
        type="button"
        className="models-row-main"
        onClick={() => onOpen(model.id)}
        aria-label={t("rows.openModelDetail", { id: model.id })}
      >
        <span className="models-row-id">{model.name ?? model.id}</span>
        <span className="models-row-meta">{model.id}</span>
      </button>
      <div className="models-row-tags">
        {model.reasoning ? <Chip active>{t("rows.reasoning")}</Chip> : null}
        <Chip>{modelInputsLabel(model.inputs)}</Chip>
        {model.contextWindow ? (
          <Chip>{t("rows.contextWindow", { value: model.contextWindow })}</Chip>
        ) : null}
        {model.isDefault ? <Badge variant="ok">{t("rows.defaultBadge")}</Badge> : null}
        {relations.has("fallback") ? <Badge variant="warn">{t("rows.fallbackBadge")}</Badge> : null}
        {relations.has("primary") && !model.isDefault ? (
          <Badge variant="running">{t("rows.primaryBadge")}</Badge>
        ) : null}
        {model.isReferenced ? <Badge variant="warn">{t("rows.referencedBadge")}</Badge> : null}
        {roles.length > 0 ? (
          <Chip>{t("rows.usageRoles", { roles: roles.slice(0, 3).join(", ") })}</Chip>
        ) : null}
      </div>
      <div className="models-row-actions">
        <button type="button" className="models-link-btn" onClick={() => onOpen(model.id)}>
          {t("rows.edit")}
        </button>
        <button
          type="button"
          className="models-link-btn models-link-btn-danger"
          onClick={() => onPreviewDelete(model.id)}
        >
          {t("rows.checkDeleteImpact")}
        </button>
      </div>
    </li>
  );
}
