"use client";

import { Lock, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useDeckAgentsStore } from "@/stores/deck-agents";

interface Props {
  agentId: string;
}

const STREAMS = ["lifecycle", "assistant", "tool", "thinking"] as const;

export function ChannelEventStreamSection({ agentId }: Props) {
  const t = useTranslations("agentDetail.eventStreams");
  const { currentEventStreams, fetchEventStreams, setEventStreams } = useDeckAgentsStore();

  useEffect(() => {
    void fetchEventStreams(agentId);
  }, [agentId, fetchEventStreams]);

  const handleToggle = useCallback(
    (stream: string, checked: boolean) => {
      if (!currentEventStreams) {
        return;
      }
      const updated = checked
        ? [...currentEventStreams.eventStreams, stream]
        : currentEventStreams.eventStreams.filter((s) => s !== stream);
      void setEventStreams(agentId, updated, currentEventStreams.configHash);
    },
    [agentId, currentEventStreams, setEventStreams],
  );

  if (!currentEventStreams) {
    return null;
  }

  const enabledSet = new Set(currentEventStreams.eventStreams);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-[var(--brand)]" />
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
          {currentEventStreams.isDefault && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {t("usingDefault")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chat — always on, locked */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-[var(--text-secondary)]" />
            <div>
              <span className="text-sm">{t("chat")}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">{t("chatHint")}</span>
            </div>
          </div>
          <Switch checked disabled aria-label={t("chat")} />
        </div>

        {/* Configurable streams */}
        {STREAMS.map((stream) => (
          <div key={stream} className="flex items-center justify-between">
            <div>
              <span className="text-sm">{t(stream)}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">
                {t(`${stream}Hint`)}
              </span>
            </div>
            <Switch
              checked={enabledSet.has(stream)}
              onCheckedChange={(checked) => handleToggle(stream, checked)}
              aria-label={t(stream)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
