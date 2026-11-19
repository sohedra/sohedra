// A main-thread function written in a `.ts` module runs on the main thread when a component's
// handler calls it.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import Tripler from "../fixtures/library/Tripler.svelte";

it("runs a main-thread function from a plain module", async () => {
	const log: unknown[] = [];
	const { container } = await render(Tripler, { props: { log } });
	await fireEvent.tap(container.querySelector(".triple")!);
	expect(log).toEqual([42]);
});
