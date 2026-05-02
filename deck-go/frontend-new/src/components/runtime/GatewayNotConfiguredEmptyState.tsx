import { useTranslations } from "../../i18n/provider";

const GATEWAY_NOT_CONFIGURED_CODE = "gateway_not_configured";

export function isGatewayNotConfiguredError(error: unknown) {
  return error instanceof Error && error.message.includes(GATEWAY_NOT_CONFIGURED_CODE);
}

export function gatewayNotConfiguredValue(error: unknown, fallback: string) {
  return isGatewayNotConfiguredError(error)
    ? GATEWAY_NOT_CONFIGURED_CODE
    : error instanceof Error
      ? error.message
      : fallback;
}

type GatewayNotConfiguredEmptyStateProps = {
  className?: string;
};

export function GatewayNotConfiguredEmptyState({
  className = "",
}: GatewayNotConfiguredEmptyStateProps) {
  const t = useTranslations();
  const classes = ["deckgo-surface-tile", className].filter(Boolean).join(" ");

  return (
    <div className={classes} data-testid="empty-state-not-configured">
      <p className="deckgo-surface-label">{t("panel.notConfigured.title")}</p>
      <p className="deckgo-note">{t("panel.notConfigured.empty")}</p>
    </div>
  );
}

export function isGatewayNotConfiguredValue(value: string) {
  return value === GATEWAY_NOT_CONFIGURED_CODE;
}
