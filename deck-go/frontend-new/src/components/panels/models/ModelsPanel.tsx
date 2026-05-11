import { useCallback, useMemo, useState } from "react";
import type {
  DeckGoModelCatalogMode,
  DeckGoModelCatalogProvidersResponse,
  DeckGoModelDeleteCommitRequest,
  DeckGoModelDeletePreviewRequest,
  DeckGoModelImpactPreview,
  DeckGoModelProviderDeleteCommitRequest,
  DeckGoModelProviderDeletePreviewRequest,
  DeckGoModelProviderUpsertRequest,
  DeckGoModelUpsertRequest,
} from "@/api-types";
import { isDataFabricError } from "@/data/errors/error-types";
import {
  useDeleteModelMutation,
  useDeleteModelProviderMutation,
  usePreviewModelDeleteMutation,
  usePreviewProviderDeleteMutation,
  useSetModelsCatalogModeMutation,
  useUpsertModelMutation,
  useUpsertModelProviderMutation,
} from "@/data/modules/models/mutations";
import {
  useModelAuthOverviewQuery,
  useModelCatalogProvidersQuery,
  useModelsConfigDetailQuery,
} from "@/data/modules/models/queries";
import { Banner, Button, Spinner } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";
import { ImpactPreviewDialog } from "./dialogs/ImpactPreviewDialog";
import { TypeToConfirmDialog } from "./dialogs/TypeToConfirmDialog";
import { ModelDrawer } from "./drawers/ModelDrawer";
import { ProviderDrawer } from "./drawers/ProviderDrawer";
import { findModel, findProvider, listProviders } from "./lib/models-selectors";
import { CatalogHeader } from "./parts/CatalogHeader";
import { ProviderListSection } from "./parts/ProviderListSection";
import { UsagePolicyOverview } from "./parts/UsagePolicyOverview";
import { AddProviderWizard } from "./wizard/AddProviderWizard";
import "./models-panel.css";

type ProviderEditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; providerId: string };

type ModelEditorState =
  | { kind: "closed" }
  | { kind: "create"; providerId: string }
  | { kind: "edit"; providerId: string; modelId: string };

type DeleteFlowState =
  | { kind: "idle" }
  | {
      kind: "preview-provider";
      providerId: string;
      preview?: DeckGoModelImpactPreview;
      error?: string;
    }
  | {
      kind: "confirm-provider";
      providerId: string;
      preview: DeckGoModelImpactPreview;
      confirmOpen?: boolean;
      error?: string;
    }
  | {
      kind: "preview-model";
      providerId: string;
      modelId: string;
      preview?: DeckGoModelImpactPreview;
      error?: string;
    }
  | {
      kind: "confirm-model";
      providerId: string;
      modelId: string;
      preview: DeckGoModelImpactPreview;
      confirmOpen?: boolean;
      error?: string;
    };

type ModeFlowState =
  | { kind: "idle" }
  | {
      kind: "preview";
      mode: DeckGoModelCatalogMode;
      preview?: DeckGoModelImpactPreview;
      baseHash?: string;
      error?: string;
    }
  | {
      kind: "confirm";
      mode: DeckGoModelCatalogMode;
      preview: DeckGoModelImpactPreview;
      baseHash: string;
      confirmOpen?: boolean;
      error?: string;
    };

const CONFIRM_TEXT_DELETE = "delete";
const CONFIRM_TEXT_REPLACE = "replace";

function asErrorMessage(error: unknown, fallback: string): string {
  if (isDataFabricError(error)) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function isConflictError(error: unknown): boolean {
  return isDataFabricError(error) && error.kind === "conflict";
}

function catalogProvidersFromResponse(response: DeckGoModelCatalogProvidersResponse | undefined) {
  return response?.providers ?? response?.payload?.providers ?? [];
}

export function ModelsPanel() {
  const t = useTranslations("models");
  const detailQuery = useModelsConfigDetailQuery();
  const catalogQuery = useModelCatalogProvidersQuery();
  const authQuery = useModelAuthOverviewQuery();

  const upsertProvider = useUpsertModelProviderMutation();
  const previewProviderDelete = usePreviewProviderDeleteMutation();
  const deleteProvider = useDeleteModelProviderMutation();
  const upsertModel = useUpsertModelMutation();
  const previewModelDelete = usePreviewModelDeleteMutation();
  const deleteModel = useDeleteModelMutation();
  const setMode = useSetModelsCatalogModeMutation();

  const [providerEditor, setProviderEditor] = useState<ProviderEditorState>({ kind: "closed" });
  const [modelEditor, setModelEditor] = useState<ModelEditorState>({ kind: "closed" });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialProviderId, setWizardInitialProviderId] = useState<string | undefined>();
  const [deleteFlow, setDeleteFlow] = useState<DeleteFlowState>({ kind: "idle" });
  const [modeFlow, setModeFlow] = useState<ModeFlowState>({ kind: "idle" });
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [conflict, setConflict] = useState(false);

  const detail = detailQuery.data?.detail;
  const baseHash = detail?.hash;
  const providers = useMemo(() => listProviders(detail), [detail]);
  const catalogProviders = useMemo(
    () => catalogProvidersFromResponse(catalogQuery.data),
    [catalogQuery.data],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([detailQuery.refetch(), catalogQuery.refetch(), authQuery.refetch()]);
  }, [detailQuery, catalogQuery, authQuery]);

  const handleProviderSubmit = useCallback(
    async (request: DeckGoModelProviderUpsertRequest) => {
      try {
        await upsertProvider.mutateAsync(request);
        setConflict(false);
        setGlobalError(undefined);
        setProviderEditor({ kind: "closed" });
      } catch (error) {
        if (isConflictError(error)) {
          setConflict(true);
        }
        setGlobalError(asErrorMessage(error, t("errors.upsertFailed")));
        throw error;
      }
    },
    [t, upsertProvider],
  );

  const handleModelSubmit = useCallback(
    async (request: DeckGoModelUpsertRequest) => {
      try {
        await upsertModel.mutateAsync(request);
        setConflict(false);
        setGlobalError(undefined);
        setModelEditor({ kind: "closed" });
      } catch (error) {
        if (isConflictError(error)) {
          setConflict(true);
        }
        setGlobalError(asErrorMessage(error, t("errors.upsertFailed")));
        throw error;
      }
    },
    [t, upsertModel],
  );

  const startProviderDelete = useCallback(
    async (providerId: string) => {
      if (!baseHash) {
        setGlobalError(t("errors.baseHashMissing"));
        return;
      }
      setDeleteFlow({ kind: "preview-provider", providerId });
      const req: DeckGoModelProviderDeletePreviewRequest = {
        expectedBaseHash: baseHash,
        providerId,
      };
      try {
        const response = await previewProviderDelete.mutateAsync(req);
        setDeleteFlow({
          kind: "confirm-provider",
          providerId,
          preview: response.preview,
        });
      } catch (error) {
        setDeleteFlow({
          kind: "preview-provider",
          providerId,
          error: asErrorMessage(error, t("errors.previewFailed")),
        });
      }
    },
    [baseHash, previewProviderDelete, t],
  );

  const commitProviderDelete = useCallback(async () => {
    if (deleteFlow.kind !== "confirm-provider" || !baseHash) {
      return;
    }
    const req: DeckGoModelProviderDeleteCommitRequest = {
      expectedBaseHash: baseHash,
      providerId: deleteFlow.providerId,
      impactToken: deleteFlow.preview.impactToken,
      confirmText: CONFIRM_TEXT_DELETE,
    };
    try {
      await deleteProvider.mutateAsync(req);
      setDeleteFlow({ kind: "idle" });
    } catch (error) {
      if (isConflictError(error)) {
        setConflict(true);
      }
      setDeleteFlow({
        ...deleteFlow,
        error: asErrorMessage(error, t("errors.deleteFailed")),
      });
    }
  }, [baseHash, deleteFlow, deleteProvider, t]);

  const startModelDelete = useCallback(
    async (providerId: string, modelId: string) => {
      if (!baseHash) {
        setGlobalError(t("errors.baseHashMissing"));
        return;
      }
      setDeleteFlow({ kind: "preview-model", providerId, modelId });
      const req: DeckGoModelDeletePreviewRequest = {
        expectedBaseHash: baseHash,
        providerId,
        modelId,
      };
      try {
        const response = await previewModelDelete.mutateAsync(req);
        setDeleteFlow({
          kind: "confirm-model",
          providerId,
          modelId,
          preview: response.preview,
        });
      } catch (error) {
        setDeleteFlow({
          kind: "preview-model",
          providerId,
          modelId,
          error: asErrorMessage(error, t("errors.previewFailed")),
        });
      }
    },
    [baseHash, previewModelDelete, t],
  );

  const commitModelDelete = useCallback(async () => {
    if (deleteFlow.kind !== "confirm-model" || !baseHash) {
      return;
    }
    const req: DeckGoModelDeleteCommitRequest = {
      expectedBaseHash: baseHash,
      providerId: deleteFlow.providerId,
      modelId: deleteFlow.modelId,
      impactToken: deleteFlow.preview.impactToken,
      confirmText: CONFIRM_TEXT_DELETE,
    };
    try {
      await deleteModel.mutateAsync(req);
      setDeleteFlow({ kind: "idle" });
    } catch (error) {
      if (isConflictError(error)) {
        setConflict(true);
      }
      setDeleteFlow({
        ...deleteFlow,
        error: asErrorMessage(error, t("errors.deleteFailed")),
      });
    }
  }, [baseHash, deleteFlow, deleteModel, t]);

  const startModeChange = useCallback(
    async (mode: DeckGoModelCatalogMode) => {
      if (!baseHash) {
        setGlobalError(t("errors.baseHashMissing"));
        return;
      }
      if (mode === detail?.mode) {
        return;
      }
      setModeFlow({ kind: "preview", mode, baseHash });
      try {
        const response = await setMode.mutateAsync({
          expectedBaseHash: baseHash,
          mode,
          dryRun: true,
        });
        if ("preview" in response) {
          setModeFlow({
            kind: "confirm",
            mode,
            preview: response.preview,
            baseHash: response.baseHash,
          });
        } else {
          setModeFlow({ kind: "idle" });
        }
      } catch (error) {
        setModeFlow({
          kind: "preview",
          mode,
          baseHash,
          error: asErrorMessage(error, t("errors.previewFailed")),
        });
      }
    },
    [baseHash, detail?.mode, setMode, t],
  );

  const commitModeChange = useCallback(async () => {
    if (modeFlow.kind !== "confirm") {
      return;
    }
    try {
      await setMode.mutateAsync({
        expectedBaseHash: modeFlow.baseHash,
        mode: modeFlow.mode,
        dryRun: false,
        impactToken: modeFlow.preview.impactToken,
        confirmText: CONFIRM_TEXT_REPLACE,
      });
      setModeFlow({ kind: "idle" });
    } catch (error) {
      if (isConflictError(error)) {
        setConflict(true);
      }
      setModeFlow({
        ...modeFlow,
        error: asErrorMessage(error, t("errors.modeFailed")),
      });
    }
  }, [modeFlow, setMode, t]);

  const editingProvider = useMemo(() => {
    if (providerEditor.kind === "edit") {
      return findProvider(detail, providerEditor.providerId);
    }
    return undefined;
  }, [detail, providerEditor]);

  const editingModel = useMemo(() => {
    if (modelEditor.kind === "edit") {
      const provider = findProvider(detail, modelEditor.providerId);
      return findModel(provider, modelEditor.modelId);
    }
    return undefined;
  }, [detail, modelEditor]);

  const deleteImpactOpen =
    deleteFlow.kind === "preview-provider" ||
    deleteFlow.kind === "preview-model" ||
    (deleteFlow.kind === "confirm-provider" && !deleteFlow.confirmOpen) ||
    (deleteFlow.kind === "confirm-model" && !deleteFlow.confirmOpen);

  const deleteConfirmOpen =
    (deleteFlow.kind === "confirm-provider" || deleteFlow.kind === "confirm-model") &&
    Boolean(deleteFlow.preview) &&
    Boolean(deleteFlow.confirmOpen);

  const modeImpactOpen =
    modeFlow.kind === "preview" ||
    (modeFlow.kind === "confirm" && !(modeFlow.mode === "replace" && modeFlow.confirmOpen));

  const modeConfirmOpen =
    modeFlow.kind === "confirm" && modeFlow.mode === "replace" && Boolean(modeFlow.confirmOpen);

  const openProviderWizard = useCallback((initialProviderId?: string) => {
    setWizardInitialProviderId(initialProviderId);
    setWizardOpen(true);
  }, []);

  const closeProviderWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardInitialProviderId(undefined);
  }, []);

  const renderConfiguredProviders = () => {
    if (detailQuery.isLoading) {
      return (
        <div className="models-state-block" role="status">
          <Spinner size="md" aria-label={t("states.loading")} />
          <p>{t("states.loading")}</p>
        </div>
      );
    }
    if (detailQuery.isError) {
      return (
        <Banner variant="error">
          {asErrorMessage(detailQuery.error, t("errors.detailFailed"))}
        </Banner>
      );
    }
    if (!detail || providers.length === 0) {
      return (
        <div className="models-state-block">
          <p>{t("states.empty")}</p>
          <Button variant="primary" size="sm" onClick={() => openProviderWizard()}>
            {t("actions.addProvider")}
          </Button>
        </div>
      );
    }
    return (
      <ul className="models-list" data-testid="models-list">
        {providers.map((provider) => (
          <li key={provider.id}>
            <ProviderListSection
              provider={provider}
              onOpenProvider={(id) => setProviderEditor({ kind: "edit", providerId: id })}
              onPreviewDeleteProvider={(id) => void startProviderDelete(id)}
              onAddModel={(id) => setModelEditor({ kind: "create", providerId: id })}
              onOpenModel={(id, modelId) =>
                setModelEditor({ kind: "edit", providerId: id, modelId })
              }
              onPreviewDeleteModel={(id, modelId) => void startModelDelete(id, modelId)}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="models-panel" data-testid="models-panel">
      <CatalogHeader
        detail={detail}
        isLoading={detailQuery.isLoading}
        isRefreshing={detailQuery.isFetching && !detailQuery.isLoading}
        onRefresh={() => void refreshAll()}
        onAddProvider={() => openProviderWizard()}
        onChangeMode={(mode) => void startModeChange(mode)}
        modeBusy={setMode.isPending}
      />
      {conflict ? (
        <Banner variant="warn" role="alert">
          <span>{t("conflict.baseHashStale")}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConflict(false);
              void detailQuery.refetch();
            }}
          >
            {t("actions.refresh")}
          </Button>
        </Banner>
      ) : null}
      {globalError ? (
        <Banner variant="error" role="alert">
          <span>{globalError}</span>
          <Button variant="ghost" size="sm" onClick={() => setGlobalError(undefined)}>
            {t("actions.dismiss")}
          </Button>
        </Banner>
      ) : null}
      <UsagePolicyOverview detail={detail} />
      <section className="models-configured" data-testid="models-configured-providers">
        <header className="models-configured-head">
          <div>
            <h3>{t("configuredProviders.title")}</h3>
            <p>{t("configuredProviders.description")}</p>
          </div>
        </header>
        {renderConfiguredProviders()}
      </section>

      <ProviderDrawer
        open={providerEditor.kind !== "closed"}
        baseHash={baseHash}
        provider={editingProvider}
        isCreate={providerEditor.kind === "create"}
        busy={upsertProvider.isPending}
        conflict={conflict}
        errorMessage={globalError}
        onClose={() => setProviderEditor({ kind: "closed" })}
        onSubmit={handleProviderSubmit}
      />
      <ModelDrawer
        open={modelEditor.kind !== "closed"}
        baseHash={baseHash}
        providerId={modelEditor.kind !== "closed" ? modelEditor.providerId : ""}
        model={editingModel}
        isCreate={modelEditor.kind === "create"}
        busy={upsertModel.isPending}
        conflict={conflict}
        errorMessage={globalError}
        onClose={() => setModelEditor({ kind: "closed" })}
        onSubmit={handleModelSubmit}
      />
      <AddProviderWizard
        open={wizardOpen}
        baseHash={baseHash}
        catalogProviders={catalogProviders}
        existingProviderIds={providers.map((provider) => provider.id)}
        initialProviderId={wizardInitialProviderId}
        busy={upsertProvider.isPending}
        errorMessage={globalError}
        onClose={closeProviderWizard}
        onEditExisting={(providerId) => setProviderEditor({ kind: "edit", providerId })}
        onSubmit={async (request) => {
          await handleProviderSubmit(request);
          closeProviderWizard();
        }}
      />
      <ImpactPreviewDialog
        open={deleteImpactOpen}
        busy={previewProviderDelete.isPending || previewModelDelete.isPending}
        preview={
          deleteFlow.kind === "confirm-provider" || deleteFlow.kind === "confirm-model"
            ? deleteFlow.preview
            : undefined
        }
        errorMessage={deleteFlow.kind !== "idle" ? deleteFlow.error : undefined}
        onCancel={() => setDeleteFlow({ kind: "idle" })}
        onConfirm={() => {
          if (deleteFlow.kind === "confirm-provider") {
            setDeleteFlow({
              ...deleteFlow,
              confirmOpen: true,
              error: undefined,
            });
          } else if (deleteFlow.kind === "confirm-model") {
            setDeleteFlow({
              ...deleteFlow,
              confirmOpen: true,
              error: undefined,
            });
          }
        }}
      />
      <TypeToConfirmDialog
        open={deleteConfirmOpen}
        title={
          deleteFlow.kind === "confirm-provider"
            ? t("confirmDialog.provider.title", { provider: deleteFlow.providerId })
            : deleteFlow.kind === "confirm-model"
              ? t("confirmDialog.model.title", {
                  provider: deleteFlow.providerId,
                  model: deleteFlow.modelId,
                })
              : ""
        }
        description={
          deleteFlow.kind === "confirm-provider"
            ? t("confirmDialog.provider.description")
            : deleteFlow.kind === "confirm-model"
              ? t("confirmDialog.model.description")
              : ""
        }
        expectedText={CONFIRM_TEXT_DELETE}
        busy={deleteProvider.isPending || deleteModel.isPending}
        errorMessage={deleteFlow.kind !== "idle" ? deleteFlow.error : undefined}
        onCancel={() => setDeleteFlow({ kind: "idle" })}
        onConfirm={() => {
          if (deleteFlow.kind === "confirm-provider") {
            void commitProviderDelete();
          } else if (deleteFlow.kind === "confirm-model") {
            void commitModelDelete();
          }
        }}
      />
      <ImpactPreviewDialog
        open={modeImpactOpen}
        busy={setMode.isPending}
        preview={modeFlow.kind === "confirm" ? modeFlow.preview : undefined}
        errorMessage={modeFlow.kind !== "idle" ? modeFlow.error : undefined}
        onCancel={() => setModeFlow({ kind: "idle" })}
        onConfirm={() => {
          if (modeFlow.kind === "confirm") {
            if (modeFlow.mode === "replace") {
              setModeFlow({ ...modeFlow, confirmOpen: true, error: undefined });
            } else {
              void commitModeChange();
            }
          }
        }}
      />
      <TypeToConfirmDialog
        open={modeConfirmOpen}
        title={t("confirmDialog.mode.title")}
        description={t("confirmDialog.mode.description")}
        expectedText={CONFIRM_TEXT_REPLACE}
        busy={setMode.isPending}
        errorMessage={modeFlow.kind !== "idle" ? modeFlow.error : undefined}
        onCancel={() => setModeFlow({ kind: "idle" })}
        onConfirm={() => void commitModeChange()}
      />
    </section>
  );
}
