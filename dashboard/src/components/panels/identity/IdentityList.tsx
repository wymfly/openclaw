"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIdentityStore } from "@/stores/deck-identity";

export function IdentityList() {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const { links, loading, selectedCanonical, selectCanonical, unlinkPeer } = useIdentityStore();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {t("title")}
      </div>

      {/* Identity list */}
      <div className="flex-1 overflow-y-auto">
        {loading && links.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {tc("loading")}
          </div>
        )}
        {!loading && links.length === 0 && (
          <div
            className="flex items-center justify-center h-full p-3 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("noLinks")}
          </div>
        )}
        {links.map((link) => {
          const isSelected = selectedCanonical === link.canonical;

          return (
            <button
              key={link.canonical}
              type="button"
              onClick={() => selectCanonical(link.canonical)}
              className="flex flex-col w-full px-3 py-2 text-left text-xs transition-colors"
              style={{
                borderLeft: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isSelected ? "var(--primary)" : "var(--foreground)",
              }}
            >
              {/* Canonical name */}
              <span className="font-medium truncate w-full">{link.canonical}</span>

              {/* Peer badges */}
              {link.peers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {link.peers.map((peer) => (
                    <span
                      key={`${peer.channel}:${peer.peerId}`}
                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {peer.channel}: {peer.peerId}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={t("unlink")}
                        className="ml-0.5 rounded hover:opacity-80 cursor-pointer"
                        style={{ color: "var(--destructive)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(t("unlinkConfirm"))) {
                            void unlinkPeer(link.canonical, peer.channel, peer.peerId);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.confirm(t("unlinkConfirm"))) {
                              void unlinkPeer(link.canonical, peer.channel, peer.peerId);
                            }
                          }
                        }}
                      >
                        <X size={10} />
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
