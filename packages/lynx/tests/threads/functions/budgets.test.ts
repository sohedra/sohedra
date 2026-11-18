// What a ref's initial value costs: it rides in every copy of every function that captures it,
// in the first frame's markup and in the background's patches. A change that sends more must raise
// the budget here, on purpose.

import { expect, it } from "@rstest/core";

import { readGlobal } from "../../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import InitialValues from "../../fixtures/threads/functions/InitialValues.svelte";
import drawInitialValues from "../../fixtures/threads/functions/InitialValues.svelte?first-frame";
import { startFunctionsPage } from "./pages.ts";

/**
 * The bytes of a ref's initial value in 100 rows' handlers, as measured: 73 for each row on each
 * side, the value written once in each copy of the handler.
 */
const BUDGET = { firstFrame: 7300, firstPatch: 7300 };

/** The bytes of every `_initValue` in `text`, as written there. */
function initialValueBytes(text: string): number {
	let bytes = 0;
	for (const [match] of text.matchAll(/"_initValue":\{[^}]*\}/g)) bytes += match.length;
	return bytes;
}

it("keeps the bytes of a ref's initial value in 100 rows' handlers within its budget", async () => {
	const page = startFunctionsPage(InitialValues, { draw: drawInitialValues, firstFrame: true });
	const markup = page.asMainThread(() =>
		(readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({}),
	);
	// The markup writes JSON in attributes with its quotes as entities.
	const firstFrame = initialValueBytes(markup.replaceAll("&quot;", '"'));
	await page.settle();
	const firstPatch = initialValueBytes(JSON.stringify(page.patches[0]));
	expect(firstFrame).toBeGreaterThan(0);
	expect(firstFrame).toBeLessThanOrEqual(BUDGET.firstFrame);
	expect(firstPatch).toBeLessThanOrEqual(BUDGET.firstPatch);
	expect(page.errors).toEqual([]);
});
