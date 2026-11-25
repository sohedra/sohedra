// The wire's messages only a development build reports: those of `checkMessage`, which a receiver
// calls in development builds only. They are part of the wire's catalogue, in a file of their own:
// the main thread's runtime and the app's main-thread script share `catalogue.ts`, so a production
// build drops what only this file holds, and not what `catalogue.ts` holds.

import { THREAD_NAMES } from "./catalogue.ts";
import type { WireDetails, WireDevelopmentCode, WireReport } from "./catalogue.ts";
import { catalogueError } from "./messages.ts";
import type { Catalogue } from "./messages.ts";

/** The messages of the wire that only a development build reports. */
export const WIRE_DEVELOPMENT_CATALOGUE: Catalogue<Pick<WireDetails, WireDevelopmentCode>> = {
	threads_from_different_builds: {
		message: ({ thread, received, expected }) =>
			"This page's main thread and background thread come from different builds of the app.\n" +
			`Seen on ${THREAD_NAMES[thread]}: it reads version ${expected} of what the threads send each other, and got version ${received}.`,
		fix: () =>
			"Build the app again and reopen the page, so both threads load from one build. If the host caches bundles, clear its cache.",
		docs: "threads_from_different_builds",
	},
	page_reloaded_on_one_thread: {
		message: ({ thread, received, generation }) =>
			"This page reloaded on one of its threads only.\n" +
			`Seen on ${THREAD_NAMES[thread]}: it shows load ${generation} of the page and got a message of load ${received}.`,
		fix: () =>
			"Reload the page through Lynx, with `lynx.reload()` or the host's reload, so both threads start the new page together.",
		docs: "page_reloaded_on_one_thread",
	},
};

/**
 * The error for a message only a development build reports, for code a production build drops:
 * elsewhere, its entries would ship.
 */
export function wireDevelopmentError<Code extends WireDevelopmentCode>(
	report: WireReport<Code>,
): Error & { code: Code } {
	return catalogueError(WIRE_DEVELOPMENT_CATALOGUE, report);
}
