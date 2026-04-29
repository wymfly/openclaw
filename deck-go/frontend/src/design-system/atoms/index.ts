/**
 * design-system atoms — Phase 1a + 1b barrel.
 *
 * Phase 1a (complete):
 *   Action: Button, IconButton
 *   Status: Badge, Chip, Tag, Spinner, SkeletonLoader, Banner
 *   Streaming: StreamingCursor, WaitingDots, ProgressBar
 *
 * Phase 1b (pending): containers / form / overlay
 */

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";

export { Badge, type BadgeProps, type BadgeVariant } from "./Badge";
export { Chip, type ChipProps } from "./Chip";
export { Tag, type TagProps } from "./Tag";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { SkeletonLoader, type SkeletonLoaderProps } from "./SkeletonLoader";
export { Banner, type BannerProps, type BannerVariant, type BannerLive } from "./Banner";

export { StreamingCursor, type StreamingCursorProps } from "./StreamingCursor";
export { WaitingDots, type WaitingDotsProps } from "./WaitingDots";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
