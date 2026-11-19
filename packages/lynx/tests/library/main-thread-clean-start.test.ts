// Two tests in one file, each with its own page: the second one's main-thread functions run once,
// and hear their replies, as the first's do.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import MainThreadFunctions from "../fixtures/library/MainThreadFunctions.svelte";

async function tapBoxAndSum() {
	const log: unknown[] = [];
	const { container } = await render(MainThreadFunctions, { props: { log } });
	await fireEvent.tap(container.querySelector(".box")!);
	await fireEvent.tap(container.querySelector(".sum")!);
	return log;
}

it("runs main-thread functions on the first page", async () => {
	expect(await tapBoxAndSum()).toEqual(["main-thread tap", "sum 3"]);
});

it("runs them again on the next page, from a clean start", async () => {
	expect(await tapBoxAndSum()).toEqual(["main-thread tap", "sum 3"]);
});
