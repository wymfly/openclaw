import type { DeckGoModelImpactPreview } from "@/api-types";
import { Badge, Banner, Button, Modal } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { impactReferenceCount, severityVariant, shouldBlockCommit } from "../lib/models-selectors";

export interface ImpactPreviewDialogProps {
  open: boolean;
  busy: boolean;
  preview: DeckGoModelImpactPreview | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  errorMessage?: string;
}

export function ImpactPreviewDialog(props: ImpactPreviewDialogProps) {
  const t = useTranslations("models");
  const preview = props.preview;
  const refs = preview ? impactReferenceCount(preview) : 0;
  const blocked = preview ? shouldBlockCommit(preview) : false;
  const severity = preview ? severityVariant(preview.severity) : "info";

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      size="md"
      aria-label={t("impactDialog.title")}
    >
      <header className="models-dialog-head">
        <h3>{t("impactDialog.title")}</h3>
        {preview ? (
          <Badge
            variant={
              severity === "danger"
                ? "err"
                : severity === "warning"
                  ? "warn"
                  : severity === "info"
                    ? "running"
                    : "ok"
            }
          >
            {t(`impactDialog.severity.${preview.severity}`)}
          </Badge>
        ) : null}
      </header>
      {props.errorMessage ? <Banner variant="error">{props.errorMessage}</Banner> : null}
      {!preview ? (
        <p className="models-dialog-empty">{t("impactDialog.loading")}</p>
      ) : (
        <div className="models-dialog-body">
          <p>{t(`impactDialog.scope.${preview.scope}`)}</p>
          <p className="models-dialog-meta">{t("impactDialog.referenceCount", { count: refs })}</p>
          {preview.unavailableProviders && preview.unavailableProviders.length > 0 ? (
            <Banner variant="warn">
              {t("impactDialog.unavailableProviders", {
                count: preview.unavailableProviders.length,
              })}
            </Banner>
          ) : null}
          {refs > 0 ? (
            <ul className="models-dialog-list">
              {preview.references.map((ref, index) => (
                <li key={`${ref.kind}-${ref.path}-${index}`}>
                  <code>{ref.path}</code>
                  <span className="models-dialog-meta">
                    {t(`impactDialog.refKind.${ref.kind}`)}
                    {ref.providerId ? ` · ${ref.providerId}` : ""}
                    {ref.modelId ? `/${ref.modelId}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="models-dialog-empty">{t("impactDialog.noReferences")}</p>
          )}
          {preview.defaultsAffected && preview.defaultsAffected.length > 0 ? (
            <Banner variant="warn">
              {t("impactDialog.defaultsAffected", {
                paths: preview.defaultsAffected.join(", "),
              })}
            </Banner>
          ) : null}
        </div>
      )}
      <footer className="models-dialog-foot">
        <Button variant="ghost" size="sm" onClick={props.onCancel} disabled={props.busy}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={props.onConfirm}
          disabled={!preview || props.busy || blocked}
        >
          {blocked ? t("impactDialog.blocked") : t("impactDialog.continue")}
        </Button>
      </footer>
    </Modal>
  );
}
