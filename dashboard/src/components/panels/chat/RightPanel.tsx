"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "deck:rightPanelWidth";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

interface RightPanelProps {
  mode: "hidden" | "canvas" | "artifact";
  onClose: () => void;
  children: React.ReactNode;
}

export function RightPanel({ mode, onClose: _onClose, children }: RightPanelProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_WIDTH;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const isDragging = useRef(false);
  const isOpen = mode !== "hidden";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX;
        const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + delta));
        setWidth(newW);
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        localStorage.setItem(STORAGE_KEY, String(width));
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width],
  );

  // Save width on change
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(STORAGE_KEY, String(width));
    }
  }, [width, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="flex shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] relative"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)]/20 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
