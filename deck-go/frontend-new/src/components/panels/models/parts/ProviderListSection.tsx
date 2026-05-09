import { useState } from "react";
import type { DeckGoModelProviderEntry } from "@/api-types";
import { Badge, Chip } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { describeSecretStatus, isProviderReferenced } from "../lib/models-selectors";
import { ModelRow } from "./ModelRow";

export interface ProviderListSectionProps {
  provider: DeckGoModelProviderEntry;
  onOpenProvider: (providerId: string) => void;
  onPreviewDeleteProvider: (providerId: string) => void;
  onAddModel: (providerId: string) => void;
  onOpenModel: (providerId: string, modelId: string) => void;
  onPreviewDeleteModel: (providerId: string, modelId: string) => void;
}

export function ProviderListSection(props: ProviderListSectionProps) {
  const t = useTranslations("models");
  const { provider } = props;
  const [collapsed, setCollapsed] = useState(false);
  const referenced = isProviderReferenced(provider);
  const secret = describeSecretStatus(provider.apiKeyStatus);

  return (
    <section
      className="models-section"
      data-testid={`models-section-${provider.id}`}
      data-referenced={referenced || undefined}
    >
      <header className="models-section-head">
        <button
          type="button"
          className="models-section-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls={`models-section-body-${provider.id}`}
        >
          <span className="models-section-title">{provider.id}</span>
          <span className="models-section-meta">{provider.api ?? t("provider.apiUnknown")}</span>
        </button>
        <div className="models-section-status">
          <Chip>{t("provider.modelsCount", { count: provider.modelCount })}</Chip>
          <Chip>
            {t("provider.authMode", {
              mode: provider.auth ?? t("provider.authNone"),
            })}
          </Chip>
          <Chip>{t(`secret.${secret}`)}</Chip>
          {provider.injectNumCtxForOpenAICompat ? <Chip>{t("provider.injectNumCtx")}</Chip> : null}
          {provider.authHeader ? <Chip>{t("provider.authHeader")}</Chip> : null}
          {referenced ? <Badge variant="warn">{t("provider.referenced")}</Badge> : null}
        </div>
        <div className="models-section-actions">
          <button
            type="button"
            className="models-link-btn"
            onClick={() => props.onOpenProvider(provider.id)}
          >
            {t("provider.edit")}
          </button>
          <button
            type="button"
            className="models-link-btn"
            onClick={() => props.onAddModel(provider.id)}
          >
            {t("provider.addModel")}
          </button>
          <button
            type="button"
            className="models-link-btn models-link-btn-danger"
            onClick={() => props.onPreviewDeleteProvider(provider.id)}
          >
            {t("provider.previewDelete")}
          </button>
        </div>
      </header>
      {!collapsed ? (
        <ul
          id={`models-section-body-${provider.id}`}
          className="models-section-body"
          aria-label={t("provider.modelsListLabel", { provider: provider.id })}
        >
          {provider.models.length === 0 ? (
            <li className="models-section-empty">{t("provider.noModels")}</li>
          ) : (
            provider.models.map((model) => (
              <ModelRow
                key={model.id}
                providerId={provider.id}
                model={model}
                onOpen={(modelId) => props.onOpenModel(provider.id, modelId)}
                onPreviewDelete={(modelId) => props.onPreviewDeleteModel(provider.id, modelId)}
              />
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
