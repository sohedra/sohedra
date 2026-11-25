// The wire's messages only a development build reports: those of `checkMessage`, which a receiver
// calls in development builds only, and a kind a reader does not know (./unknown-kind.ts). They are part of the wire's catalogue, in a file of their own:
// the main thread's runtime and the app's main-thread script share `catalogue.ts`, so a production
// build drops what only this file holds, and not what `catalogue.ts` holds.

import { THREAD_NAMES } from "./catalogue.ts";
import type { WireDetails, WireDevelopmentCode, WireReport } from "./catalogue.ts";
import { catalogueError } from "./messages.ts";
import type { Catalogue } from "./messages.ts";
import type { Thread } from "./names.ts";
import { unknownKind } from "./unknown-kind.ts";

/** The fix for threads that do not come from one build. */
const ONE_BUILD = "Build the app again and reopen the page, so both threads load from one build.";

/** The messages of the wire that only a development build reports. */
export const WIRE_DEVELOPMENT_CATALOGUE: Catalogue<Pick<WireDetails, WireDevelopmentCode>> = {
	threads_from_different_builds: {
		message: ({ thread, received, expected }) =>
			"This page's main thread and background thread come from different builds of the app.\n" +
			`Seen on ${THREAD_NAMES[thread]}: it reads version ${expected} of what the threads send each other, and got version ${received}.`,
		fix: () => `${ONE_BUILD} If the host caches bundles, clear its cache.`,
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
	message_kind_unknown: {
		message: ({ thread, kind }) =>
			`A message between the threads has a kind this build does not know (${kind}).\nSeen on ${THREAD_NAMES[thread]}.`,
		fix: () => `${ONE_BUILD} If they already do, report it as a bug in @sohedra/lynx.`,
		docs: "message_kind_unknown",
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

/**
 * The development error for a message, or a part of one, of a kind this build does not know: a
 * reader's default branch, which `value: never` keeps unreachable while it handles every kind.
 */
export function unknownKindError(
	value: never,
	thread: Thread,
): Error & { code: "message_kind_unknown" } {
	return wireDevelopmentError({
		code: "message_kind_unknown",
		details: { thread, kind: unknownKind(value) },
	});
}
