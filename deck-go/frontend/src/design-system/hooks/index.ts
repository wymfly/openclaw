/**
 * design-system hooks — Phase 1a barrel.
 *
 * 5 utility hooks for atom and overlay primitives:
 * - useEscapeClose / useClickOutside / useFocusTrap — overlay dismissal & focus
 * - useKeyboardNav — arrow-key list navigation
 * - usePopover — composes the above for popover open-state management
 *
 * See: openspec/changes/frontend-design-system-via-chat/specs/frontend-design-system/spec.md
 */

export { useEscapeClose } from "./use-escape-close";
export { useClickOutside } from "./use-click-outside";
export { useFocusTrap } from "./use-focus-trap";
export {
  useKeyboardNav,
  type KeyboardNavItem,
  type UseKeyboardNavOptions,
} from "./use-keyboard-nav";
export { usePopover, type UsePopoverOptions, type UsePopoverResult } from "./use-popover";
