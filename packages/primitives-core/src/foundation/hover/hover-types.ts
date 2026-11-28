// The platform's event for a hover change.

import type { PlatformEvent, PlatformTypes, REASONS } from "../kernel/index.js";

/** The platform's event for a hover change (web: a `MouseEvent`). */
export type HoverEvent<T extends PlatformTypes> = PlatformEvent<T, typeof REASONS.triggerHover>;
