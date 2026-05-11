import type {
  DeckGoModelCatalogMode,
  DeckGoModelDetail,
  DeckGoModelEntry,
  DeckGoModelImpactPreview,
  DeckGoModelImpactSeverity,
  DeckGoModelInputModality,
  DeckGoModelBooleanToggleAction,
  DeckGoModelProviderDetail,
  DeckGoModelProviderEntry,
  DeckGoModelReferenceRelation,
  DeckGoModelSecretRef,
  DeckGoModelSecretInputStatus,
  DeckGoModelsConfigDetail,
  DeckGoModelsConfigDetailResponse,
  DeckGoModelsConfigDetailRuntime,
} from "@/api-types";

export type SecretEditAction =
  | { kind: "preserve" }
  | { kind: "clear" }
  | { kind: "set-ref"; ref: DeckGoModelSecretRef };

export function envSecretRef(id: string): DeckGoModelSecretRef {
  return { source: "env", provider: "default", id };
}

export function secretRefLabel(ref: DeckGoModelSecretRef | undefined): string {
  if (!ref) {
    return "";
  }
  if (ref.provider === "default" || ref.provider.trim() === "") {
    return `${ref.source}:${ref.id}`;
  }
  return `${ref.source}:${ref.provider}/${ref.id}`;
}

export function booleanToggleAction(enabled: boolean): DeckGoModelBooleanToggleAction {
  return enabled ? "enable" : "disable";
}

export function getDetail(
  data: DeckGoModelsConfigDetailResponse | undefined,
): DeckGoModelsConfigDetail | undefined {
  return data?.detail;
}

export function listProviders(
  detail: DeckGoModelsConfigDetail | undefined,
): DeckGoModelProviderEntry[] {
  if (!detail) {
    return [];
  }
  return [...detail.providers].toSorted((left, right) => left.id.localeCompare(right.id));
}

export function findProvider(
  detail: DeckGoModelsConfigDetail | undefined,
  providerId: string,
): DeckGoModelProviderEntry | undefined {
  return detail?.providers.find((entry) => entry.id === providerId);
}

export function findModel(
  provider: DeckGoModelProviderEntry | DeckGoModelProviderDetail | undefined,
  modelId: string,
): DeckGoModelEntry | undefined {
  return provider?.models.find((entry) => entry.id === modelId);
}

export function describeSecretStatus(status: DeckGoModelSecretInputStatus | undefined): string {
  if (!status) {
    return "missing";
  }
  return status.state;
}

export function isSecretConfigured(status: DeckGoModelSecretInputStatus | undefined): boolean {
  if (!status) {
    return false;
  }
  return status.state === "ref" || status.state === "literal-redacted";
}

export function describeMode(mode: DeckGoModelCatalogMode | undefined): "merge" | "replace" {
  return mode === "replace" ? "replace" : "merge";
}

export function severityVariant(
  severity: DeckGoModelImpactSeverity,
): "info" | "warning" | "danger" | "success" {
  switch (severity) {
    case "block":
      return "danger";
    case "warn":
      return "warning";
    case "info":
      return "info";
    case "none":
    default:
      return "success";
  }
}

export function impactReferenceCount(preview: DeckGoModelImpactPreview): number {
  return preview.references?.length ?? 0;
}

export function shouldBlockCommit(preview: DeckGoModelImpactPreview): boolean {
  return preview.severity === "block";
}

export function describeRuntime(runtime: DeckGoModelsConfigDetailRuntime): {
  catalog: "available" | "stale" | "unavailable";
  auth: "available" | "unavailable";
  probe: "available" | "unavailable";
  catalogCount: number;
  authCount: number;
} {
  return {
    catalog: runtime.catalogStatus,
    auth: runtime.authStatus,
    probe: runtime.probeStatus,
    catalogCount: runtime.catalogProviderCount ?? 0,
    authCount: runtime.authProviderCount ?? 0,
  };
}

export function modelInputsLabel(inputs: DeckGoModelInputModality[] | undefined): string {
  if (!inputs || inputs.length === 0) {
    return "text";
  }
  return inputs.join(",");
}

export function totalConfiguredModels(detail: DeckGoModelsConfigDetail | undefined): number {
  if (!detail) {
    return 0;
  }
  return detail.providers.reduce((acc, entry) => acc + entry.modelCount, 0);
}

export function modelDefaultRoles(model: DeckGoModelEntry | DeckGoModelDetail): string[] {
  return [...(model.defaultRoles ?? [])].toSorted();
}

export function modelUsageRelations(
  model: DeckGoModelEntry | DeckGoModelDetail,
): DeckGoModelReferenceRelation[] {
  return [...(model.usageRelations ?? [])].toSorted();
}

export function modelUsageRoles(model: DeckGoModelEntry | DeckGoModelDetail): string[] {
  return [...(model.usageRoles ?? [])].toSorted();
}

export function isProviderReferenced(provider: DeckGoModelProviderEntry): boolean {
  if (provider.isReferenced) {
    return true;
  }
  return provider.models.some((model) => model.isReferenced);
}
