import { useEffect, useState } from "react";
import type {
  DeckGoRuntimeCapabilities,
  DeckGoRuntimeEndpointResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { fetchEndpoint } from "../../api";
import { useTranslations } from "../../i18n/provider";

type ModeBadgeProps = {
  capabilities: DeckGoRuntimeCapabilities | null;
};

export function ModeBadge({ capabilities }: ModeBadgeProps) {
  const t = useTranslations("runtimeMode");
  const [endpoint, setEndpoint] = useState<DeckGoRuntimeEndpointResponse | null>(null);

  useEffect(() => {
    if (!capabilities) {
      return () => {};
    }
    let cancelled = false;
    void fetchEndpoint()
      .then((result) => {
        if (!cancelled) {
          setEndpoint(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEndpoint(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [capabilities?.configured, capabilities?.endpointMutable, capabilities?.mode]);

  if (!capabilities) {
    return null;
  }

  const healthy = capabilities.mode === "bundled" || capabilities.configured;
  const label =
    capabilities.mode === "bundled"
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
