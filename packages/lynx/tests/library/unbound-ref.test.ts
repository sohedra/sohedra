// A ref no element binds, which only a main-thread function reads: it starts from its initial value.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import UnboundRef from "../fixtures/library/UnboundRef.svelte";

it("gives a main-thread function a ref no element binds, from its initial value", async () => {
	const results: unknown[] = [];
	const { container } = await render(UnboundRef, { props: { results } });
	await fireEvent.tap(container.querySelector(".ask")!);
	await fireEvent.tap(container.querySelector(".ask")!);
	expect(results).toEqual(["before=41 after=42", "before=42 after=43"]);
});
