import { useTranslations } from "next-intl";
import { useSSEStatus } from "@/stores/chat-hooks";

export function SSEStatusBanner() {
  const t = useTranslations("chat");
  const status = useSSEStatus();

  if (status === "connected") {
    return null;
  }

  return (
    <div className="deck-ui-stream-banner" role="status">
      <span className="deck-ui-dot" aria-hidden="true" />
      <strong>{status === "reconnecting" ? t("sseReconnecting") : t("sseDisconnected")}</strong>
      <span>SSE · {status}</span>
    </div>
  );
}
