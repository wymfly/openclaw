"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useIdentityStore } from "@/stores/deck-identity";
import { IdentityList } from "./IdentityList";
import { LinkDialog } from "./LinkDialog";

export function IdentityPanel() {
  const t = useTranslations("identity");
  const tc = useTranslations("common");

  const { links, loading, error, selectedCanonical, fetchLinks } = useIdentityStore();
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Left sidebar — identity list */}
      <IdentityList />

      {/* Right detail area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ backgroundColor: "var(--background)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-md font-medium"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            onClick={() => setShowDialog(true)}
          >
            + {t("linkIdentity")}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="px-4 py-2 text-xs border-b"
            style={{
              borderColor: "var(--border)",
              color: "var(--destructive)",
              backgroundColor: "var(--destructive-muted)",
            }}
          >
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {tc("loading")}
            </p>
          )}

          {!loading && links.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t("noLinks")}
              </p>
            </div>
          )}

          {!loading && links.length > 0 && !selectedCanonical && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t("selectIdentity")}
              </p>
            </div>
          )}

          {!loading &&
            selectedCanonical &&
            (() => {
              const selected = links.find((l) => l.canonical === selectedCanonical);
              if (!selected) {
                return null;
              }
              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {selected.canonical}
                  </h3>
                  {selected.peers.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {t("noPeers")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {selected.peers.map((peer) => (
                        <div
                          key={`${peer.channel}:${peer.peerId}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                          style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
                        >
                          <span className="font-medium">{peer.channel}</span>
                          <span style={{ color: "var(--muted-foreground)" }}>{peer.peerId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Link dialog */}
      <LinkDialog open={showDialog} onClose={() => setShowDialog(false)} />
    </div>
  );
}
