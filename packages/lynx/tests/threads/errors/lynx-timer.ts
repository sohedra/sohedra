// Lynx's background timer, for a page's component to call: the background's `setTimeout` is
// lynx-core's, which the test page does not have.

import type { SveltePage } from "../svelte-page.ts";

/**
 * Runs a callback as lynx-core's background timer does: on the background, a turn later, and what
 * it throws goes to Lynx (the page's `errors`), as lynx-core reports it. `page` is read when the
 * timer runs, so the page can be made with the timer among its props.
 */
export function lynxTimer(page: () => SveltePage): (run: () => void) => void {
	return (run) =>
		void setTimeout(() =>
			page().asBackground(() => {
				try {
					run();
				} catch (error) {
					page().errors.push(error);
				}
			}),
		);
}

/** A tap, then a timer's turn and what it queued. */
export async function tapAndWait(page: SveltePage, name: string): Promise<void> {
	page.engine.dispatch(page.byClass(name), { type: "tap" });
	await page.settle();
	await new Promise((resolve) => setTimeout(resolve, 5));
	await page.settle();
}
