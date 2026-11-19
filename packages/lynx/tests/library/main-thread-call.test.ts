// A component calls a main-thread function, and hears what it returned.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import MainThreadCall from "../fixtures/library/MainThreadCall.svelte";

it("lets a component call a main-thread function", async () => {
	const results: unknown[] = [];
	const { container } = await render(MainThreadCall, { props: { results } });
	await fireEvent.tap(container.querySelector(".ask")!);
	// The call goes to the main thread, which runs the function; what it returns comes back.
	expect(results).toEqual([{ ok: 1 }]);
});
