import { webScheduler } from "./kernel-platform.js";
// Focus on the next frame, one pending focus per page: a newer request cancels the older.
import type { FocusableElement } from "./kernel-tabbable.js";

interface EnqueueFocusOptions {
	preventScroll?: boolean | undefined;
	sync?: boolean | undefined;
	/** Decides, when the frame runs, whether focus should still move. */
	shouldFocus?: (() => boolean) | undefined;
}

let pending: (() => void) | undefined;

// A frame of its own, outside the scheduler's shared one: a queued focus waits for no other
// frame work.
function requestOwnFrame(callback: () => void): () => void {
	if (typeof globalThis.requestAnimationFrame !== "function") {
		return webScheduler.frame(callback);
	}
	const handle = globalThis.requestAnimationFrame(() => callback());
	return () => globalThis.cancelAnimationFrame(handle);
}

/** Focuses `element` on the next frame (one pending focus at a time), or now with `sync`. */
export function enqueueFocus(
	element: FocusableElement | null | undefined,
	options: EnqueueFocusOptions = {},
): () => void {
	const { preventScroll = false, sync = false, shouldFocus } = options;
	pending?.();
	pending = undefined;

	function exec() {
		if (shouldFocus && !shouldFocus()) {
			return;
		}
		element?.focus({ preventScroll });
	}

	if (sync) {
		exec();
		return () => {};
	}
	const cancel = requestOwnFrame(exec);
	pending = cancel;
	return () => {
		if (pending === cancel) {
			cancel();
			pending = undefined;
		}
	};
}
