import type { DeckGoRuntimeCapabilities } from "../../../../contracts/generated/ts/deck-api.generated";
import { useRuntimeEndpointQuery } from "../../data/modules/settings";
import { useTranslations } from "../../i18n/provider";

type ModeBadgeProps = {
  capabilities: DeckGoRuntimeCapabilities | null;
};

export function ModeBadge({ capabilities }: ModeBadgeProps) {
  const t = useTranslations("runtimeMode");
  const endpointQuery = useRuntimeEndpointQuery({ enabled: Boolean(capabilities) });
  const endpoint = endpointQuery.data ?? null;

  if (!capabilities) {
    return null;
  }

  const localLifecycle = capabilities.supervisorState;
  const healthy = localLifecycle || capabilities.configured;
  const label = localLifecycle
    ? t("bundled")
    : capabilities.configured
      ? t("remote")
      : t("remoteFirstRun");

  return (
    <span
      className={`deck-ui-status-chip ${healthy ? "is-healthy" : "is-pending"}`}
      data-testid="mode-badge"
      title={endpoint?.url || label}
    >
      <span className="deck-ui-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
