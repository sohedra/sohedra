// Server-side browser commands for `tests/browser-setup.ts`. They run in Node, with Playwright's
// page for the test file's session.
import type { BrowserCommand } from "vitest/node";

const TESTER_FRAME = "vitest-iframe";

/**
 * Resolves once Playwright's first `vitest-iframe` frame is this file's tester. Vitest replaces
 * the previous file's iframe in the same page, and its Playwright provider runs every command on
 * the first frame with that name: while Playwright hasn't yet seen the old frame go (a loaded
 * machine), a command would run on it and fail with "Frame was detached".
 */
const awaitTesterFrame: BrowserCommand<[]> = async ({ page, testPath }) => {
	const deadline = Date.now() + 10_000;
	for (;;) {
		const frame = page.frame(TESTER_FRAME);
		if (frame && !frame.isDetached() && testerPath(frame.url()) === testPath) {
			return;
		}
		if (Date.now() > deadline) {
			throw new Error(`The tester frame for ${testPath} never became Playwright's first frame.`);
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

/**
 * Moves the real pointer off the page. The pointer stays where the last real pointer action left
 * it, across tests and files of the same page, and the browser sends real `mouseover`,
 * `mouseenter` and `mousemove` events to content that renders under it: a toast viewport that
 * then pauses its timers, a filterable menu's input that then takes focus.
 */
const parkPointer: BrowserCommand<[]> = async ({ page }) => {
	await page.mouse.move(-1, -1);
};

function testerPath(url: string): string | null {
	try {
		return new URL(url).searchParams.get("iframeId");
	} catch {
		return null;
	}
}

export const browserCommands = { awaitTesterFrame, parkPointer };
