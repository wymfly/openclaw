import { useTranslations } from "next-intl";
import { WifiOffIcon } from "@/deck-ui/icons";
import { Banner } from "@/design-system/atoms/Banner";
import { WaitingDots } from "@/design-system/atoms/WaitingDots";
import { useSSEStatus } from "@/stores/chat-hooks";

export function SSEStatusBanner() {
  const t = useTranslations("chat");
  const status = useSSEStatus();

  if (status === "connected") {
    return null;
  }

  const reconnecting = status === "reconnecting";

  return (
    <Banner variant={reconnecting ? "warn" : "error"} live={reconnecting ? "polite" : "assertive"}>
      <WifiOffIcon />
      <strong>{reconnecting ? t("sseReconnecting") : t("sseDisconnected")}</strong>
      {reconnecting ? <WaitingDots aria-label={t("sseReconnecting")} /> : null}
    </Banner>
  );
}
