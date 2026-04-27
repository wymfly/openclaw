import { useTranslations } from "next-intl";
import { WifiOffIcon } from "@/deck-ui/icons";
import { useSSEStatus } from "@/stores/chat-hooks";

export function SSEStatusBanner() {
  const t = useTranslations("chat");
  const status = useSSEStatus();

  if (status === "connected") {
    return null;
  }

  return (
    <div className="deck-ui-stream-banner" role="status">
      <WifiOffIcon />
      <strong>{status === "reconnecting" ? t("sseReconnecting") : t("sseDisconnected")}</strong>
      {status === "reconnecting" ? (
        <span className="deck-ui-dot animate-pulse" aria-hidden="true" />
      ) : null}
    </div>
  );
}
