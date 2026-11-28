import type { AnyPlatformEvent, InteractionEventType, PlatformTypes } from "../kernel/index.js";
import type { InstantType, InteractionType } from "./popup-types.js";

/**
 * What is known about one opening of a popup, in one record its `PopupLifecycle` owns. The fields
 * do not share one lifetime, so each says when it is written and when it is cleared:
 *
 * - `reason`: written by every accepted change; cleared when the popup unmounts.
 * - `preventUnmount`: written by an accepted close that asked for it; cleared by the next
 *   opening and when the popup unmounts.
 * - `method`: written by the trigger before it asks to open; cleared when `open` turns false.
 * - `event` and `eventType`: written by an accepted opening (see `keepsOpenEvent`); cleared by
 *   an accepted close.
 * - `instant`: written by every accepted change and by the parts; cleared by each new opening
 *   (an accepted one before its hook writes, one from outside when the lifecycle hears of it),
 *   else the next change replaces it.
 * - `extra`: the store's own (Popover's stick flag); fresh again when the popup unmounts.
 *
 * Which trigger the popup belongs to is not here: `ActiveTriggerStore` holds it.
 */
export class OpenSession<T extends PlatformTypes = PlatformTypes, Extra extends object = object> {
	readonly #freshExtra: () => Extra;

	/** The reason of the last accepted open change. */
	reason: string | null = $state(null);
	/** Whether the closed popup stays mounted until `unmount()` is called. */
	preventUnmount = $state(false);
	/** The kind of input that opened the popup. */
	method: InteractionType | null = $state(null);
	/** Why the popup skips its transitions, as stored: also a stale `trigger-change` while closed. */
	instant: InstantType = $state();

	// Read when input arrives and never rendered, so these are not reactive.
	/** The event that opened the popup. */
	event: AnyPlatformEvent<T> | undefined = undefined;
	/** {@link event}'s type, in core's vocabulary (the request's `eventType` fact). */
	eventType: InteractionEventType | undefined = undefined;
	/** The store's own extra fields of this opening. */
	extra: Extra;

	constructor(freshExtra: () => Extra) {
		this.#freshExtra = freshExtra;
		this.extra = freshExtra();
	}

	/** `open` turned false, by a request or from outside. */
	close(): void {
		this.method = null;
	}

	/** The popup unmounted: the opening is over. */
	end(): void {
		this.reason = null;
		this.preventUnmount = false;
		this.extra = this.#freshExtra();
	}
}
