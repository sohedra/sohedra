// The page a test rendered, and waiting for it: what crosses between the threads arrives on a later
// task, so each call that changes the page waits until both threads are idle, and fails with what
// the page reported meanwhile.

import { testingError } from "../catalogue.ts";
import { activeSession, testRunner } from "../globals.ts";
import type { TestPage } from "../page/page.ts";

/** A page `render` started, and what the test library knows of it. */
export interface Rendered {
	readonly page: TestPage;
	/** Whether the background runs: `lynx: { background: false }` leaves it out. */
	readonly background: boolean;
	/**
	 * Without the background: how many calls of background functions the first frame holds for it,
	 * which nothing will answer.
	 */
	readonly heldCalls?: () => number;
}

/** How many held calls of each page were reported. */
const reportedCalls = new WeakMap<Rendered, number>();

let current: Rendered | undefined;

/** The page this test rendered, while it runs: `cleanup` and `unmount` end it. */
export function rendered(): Rendered | undefined {
	return current !== undefined && activeSession() === current.page ? current : undefined;
}

/** Records the page `render` started. */
export function setRendered(next: Rendered | undefined): void {
	current = next;
}

/**
 * Waits until both threads are idle, then throws what the page reported meanwhile: one error as it
 * is, several together; a warning goes to the console. The page keeps none of them after. The test's code goes on with the
 * background's globals in place: it shares the background's modules.
 */
export async function settle(session: Rendered): Promise<void> {
	await session.page.settle();
	session.page.asBackground(() => undefined);
	const held = session.heldCalls?.() ?? 0;
	if (held > (reportedCalls.get(session) ?? 0)) {
		reportedCalls.set(session, held);
		session.page.errors.push(
			testingError({
				code: "background_not_started",
				details: { what: "a main-thread function's runOnBackground" },
			}),
		);
	}
	// What Lynx would show in its console and LogBox.
	for (const warning of session.page.warnings.splice(0))
		// oxlint-disable-next-line no-console -- the test's console stands for Lynx's
		console.warn(warning instanceof Error ? warning.message : warning);
	const errors = session.page.errors.splice(0);
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1)
		throw new AggregateError(
			errors,
			testingError({ code: "page_reported_errors", details: { count: errors.length } }).message,
		);
}

/** The test preset to run with, by the runner the setup file named, or both. */
export function presetName(): string {
	const rstest = "withSvelteLynx() from @sohedra/lynx/config/rstest";
	const vitest = "svelteLynx() from @sohedra/lynx/config/vitest";
	const runner = testRunner();
	return runner === "rstest" ? rstest : runner === "vitest" ? vitest : `${rstest} or ${vitest}`;
}
