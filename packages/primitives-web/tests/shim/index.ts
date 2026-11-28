// The old test renderer (`createRenderer`, `screen`, `act`, `fireEvent` and the like), kept unchanged
// for Popover's tests until their rewrite removes its last user.
import { fireEvent as domFireEvent, screen, waitFor, within } from "@testing-library/dom";
import { flushSync } from "svelte";
import { vi } from "vitest";

import { flushAfterMicrotask } from "./create-renderer.svelte.js";

export {
	createRenderer,
	flushAfterMicrotask,
	type Clock,
	type RenderResult,
} from "./create-renderer.svelte.js";
export { screen, waitFor, within };

/** The tests run in real browsers only. */
export const isJSDOM = false;

type FireEvent = typeof domFireEvent;

/** Testing Library's `fireEvent`, flushing Svelte's pending updates after each event. */
export const fireEvent: FireEvent = Object.assign(
	(element: Document | Element | Window | Node, event: Event) => {
		const result = domFireEvent(element, event);
		flushSync();
		return result;
	},
	Object.fromEntries(
		Object.entries(domFireEvent).map(([key, fire]) => [
			key,
			(...args: Parameters<typeof fire>) => {
				const result = fire(...args);
				flushSync();
				return result;
			},
		]),
	),
) as unknown as FireEvent;

/** React's `act`: runs the callback, then applies Svelte's pending updates. */
export async function act(callback: () => unknown): Promise<void> {
	await callback();
	flushSync();
	await flushAfterMicrotask();
}

/**
 * An `onsubmit` spy that prevents the submission and returns the form's entry for `name`. Read
 * it with `spy.mock.results.at(-1)?.value` (`null` when the entry is absent).
 */
export function createFormDataSpy(name: string) {
	return vi.fn((event: SubmitEvent) => {
		event.preventDefault();
		return new FormData(event.currentTarget as HTMLFormElement).get(name);
	});
}

/**
 * `pasteText`: dispatches a `paste` event carrying `value` as `text/plain` (Testing
 * Library's `fireEvent.paste` rebuilds `clipboardData` as an empty object in some browsers).
 */
export function pasteText(target: Element, value: string): boolean {
	const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(pasteEvent, "clipboardData", {
		value: { getData: (type: string) => (type === "text/plain" ? value : "") },
	});
	return fireEvent(target, pasteEvent);
}
