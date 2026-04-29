import { useCallback, useRef, useState, type RefObject } from "react";
import { useClickOutside } from "./use-click-outside";
import { useEscapeClose } from "./use-escape-close";

export interface UsePopoverOptions {
  initialOpen?: boolean;
}

export interface UsePopoverResult<TTrigger extends HTMLElement, TContent extends HTMLElement> {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  close: () => void;
  triggerRef: RefObject<TTrigger | null>;
  contentRef: RefObject<TContent | null>;
}

/**
 * Manages popover open state with Escape-close and click-outside-close.
 *
 * Click on the trigger does NOT close — the caller wires `onClick={toggle}` so
 * the trigger button toggles. Click outside both `triggerRef` and `contentRef`
 * closes.
 *
 * Used by Popover / DropdownMenu / SlashCommandPalette / MentionPopover.
 */
export function usePopover<
  TTrigger extends HTMLElement = HTMLElement,
  TContent extends HTMLElement = HTMLElement,
>(options: UsePopoverOptions = {}): UsePopoverResult<TTrigger, TContent> {
  const { initialOpen = false } = options;
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<TTrigger | null>(null);
  const contentRef = useRef<TContent | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEscapeClose(open, close);

  useClickOutside(contentRef, open, (event) => {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (triggerRef.current?.contains(target)) {
      return;
    }
    close();
  });

  return { open, setOpen, toggle, close, triggerRef, contentRef };
}
