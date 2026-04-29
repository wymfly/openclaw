import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "@/design-system/atoms/Drawer";
import "./chat-right-drawer.css";

const STORAGE_KEY = "deck:rightPanelWidth";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

interface RightPanelProps {
  mode: "hidden" | "canvas" | "artifact";
  onClose: () => void;
  children: ReactNode;
}

function clampWidth(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_WIDTH;
  }
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
}

function loadSavedWidth() {
  if (typeof window === "undefined") {
    return DEFAULT_WIDTH;
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved ? clampWidth(Number(saved)) : DEFAULT_WIDTH;
}

export function RightPanel({ mode, onClose, children }: RightPanelProps) {
  const [width, setWidth] = useState(loadSavedWidth);
  const latestWidth = useRef(width);
  const isOpen = mode !== "hidden";

  useEffect(() => {
    latestWidth.current = width;
    if (isOpen) {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    }
  }, [isOpen, width]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = latestWidth.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = clampWidth(startWidth + startX - moveEvent.clientX);
      latestWidth.current = nextWidth;
      setWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.localStorage.setItem(STORAGE_KEY, String(latestWidth.current));
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      side="right"
      width={width}
      scrim={false}
      focusTrap={false}
      aria-label="Side drawer"
      className="ds-chat-right-drawer"
      data-right-panel-mode={mode}
    >
      <div
        aria-hidden="true"
        className="ds-chat-right-drawer__resize"
        data-right-panel-resize-handle
        onMouseDown={handleMouseDown}
      />
      {children}
    </Drawer>
  );
}
