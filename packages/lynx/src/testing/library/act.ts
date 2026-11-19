// `act`: a change a test makes outside an event (a state written, a timer run), then a wait until
// both threads are idle and the change is on the page.

import { endTask } from "../globals.ts";
import { rendered, settle } from "./session.ts";

/**
 * Runs `change`, if any, with the background's globals in place, then waits until both threads are
 * idle, and fails with what the page reported meanwhile. Resolves with what `change` returned. The
 * task the test is in ends first: an event the test did not wait for finishes on its thread.
 */
export async function act<T>(change?: () => T | Promise<T>): Promise<T | undefined> {
	const session = rendered();
	if (session) await endTask();
	const result = await (session ? session.page.asBackground(() => change?.()) : change?.());
	if (session) await settle(session);
	return result;
}
