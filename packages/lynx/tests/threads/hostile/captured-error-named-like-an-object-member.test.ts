// Captured $state holding errors named `toString` and `constructor`, names every object has: the
// copy makes each a plain `Error`, as `structuredClone` does, not by looking the name up.

import { expect, it } from "@rstest/core";

import CapturedErrorName from "../../fixtures/threads/functions/CapturedErrorName.svelte";
import drawCapturedErrorName from "../../fixtures/threads/functions/CapturedErrorName.svelte?first-frame";
import { startFunctionsPage, tap } from "../functions/pages.ts";

it("sends each error as $state.snapshot does", async () => {
	const log: unknown[] = [];
	const page = startFunctionsPage(CapturedErrorName, {
		draw: drawCapturedErrorName,
		props: { log },
	});
	await page.settle();
	await tap(page, "tap");
	expect(page.errors).toEqual([]);
	expect(log).toEqual(['{"a":{"inner":{}},"b":{"inner":{}}}']);
});
