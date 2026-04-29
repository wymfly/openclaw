/**
 * design-system atoms — Phase 1a + 1b barrel.
 *
 * Phase 1a (complete):
 *   Action: Button, IconButton
 *   Status: Badge, Chip, Tag, Spinner, SkeletonLoader, Banner
 *   Streaming: StreamingCursor, WaitingDots, ProgressBar
 *
 * Phase 1b (complete):
 *   Container: Card, Block, Drawer, Modal
 *   Text: Markdown, Code, DiffView, JsonTree, TableView
 *   Form: Input, Textarea, Select, Toggle, Radio, Slider, FileInput
 *   Navigation: Tab, SegmentedControl, Breadcrumb, SidebarRow
 *   Overlay: DropdownMenu, Popover, Tooltip, Toast, ContextMenu
 */

// Phase 1a — action
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";

// Phase 1a — status
export { Badge, type BadgeProps, type BadgeVariant } from "./Badge";
export { Chip, type ChipProps } from "./Chip";
export { Tag, type TagProps } from "./Tag";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { SkeletonLoader, type SkeletonLoaderProps } from "./SkeletonLoader";
export { Banner, type BannerProps, type BannerVariant, type BannerLive } from "./Banner";

// Phase 1a — streaming
export { StreamingCursor, type StreamingCursorProps } from "./StreamingCursor";
export { WaitingDots, type WaitingDotsProps } from "./WaitingDots";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";

// Phase 1b — container
export { Card, type CardProps, type CardSurface } from "./Card";
export { Block, type BlockProps, type BlockTone } from "./Block";
export { Drawer, type DrawerProps, type DrawerSide } from "./Drawer";
export { Modal, type ModalProps, type ModalSize } from "./Modal";

// Phase 1b — text
export { Markdown, type MarkdownProps, type MarkdownMode } from "./Markdown";
export { Code, type CodeProps } from "./Code";
export { DiffView, type DiffViewProps, type DiffLine, type DiffLineKind } from "./DiffView";
export { JsonTree, type JsonTreeProps } from "./JsonTree";
export { TableView, type TableViewProps } from "./TableView";

// Phase 1b — form
export { Input, type InputProps, type InputSize } from "./Input";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectProps, type SelectSize } from "./Select";
export { Toggle, type ToggleProps } from "./Toggle";
export { Radio, type RadioProps } from "./Radio";
export { Slider, type SliderProps } from "./Slider";
export { FileInput, type FileInputProps } from "./FileInput";

// Phase 1b — navigation
export { Tab, type TabProps } from "./Tab";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedItem,
} from "./SegmentedControl";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./Breadcrumb";
export { SidebarRow, type SidebarRowProps } from "./SidebarRow";

// Phase 1b — overlay
export { Popover, type PopoverProps, type PopoverPlacement } from "./Popover";
export { DropdownMenu, type DropdownMenuProps, type DropdownMenuItem } from "./DropdownMenu";
export { Tooltip, type TooltipProps } from "./Tooltip";
export { Toast, type ToastProps, type ToastVariant } from "./Toast";
export { ContextMenu, type ContextMenuProps, type ContextMenuItem } from "./ContextMenu";
