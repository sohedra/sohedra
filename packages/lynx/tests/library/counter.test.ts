// A component library's test, written as one would be: the components imported as files, the
// assertions through `@sohedra/lynx/testing`.

import { expect, it } from "@rstest/core";
import { fireEvent, render, screen } from "@sohedra/lynx/testing";

import Counter from "../fixtures/library/Counter.svelte";

it("counts taps, from the first frame on", async () => {
	const { container } = await render(Counter);
	expect(container.localName).toBe("page");
	expect(screen.getByText("Count: 0")).toBeTruthy();

	await fireEvent.tap(screen.getByText("Add 1"));
	expect(screen.getByText("Count: 1")).toBeTruthy();
});

it("takes new props on rerender", async () => {
	const { rerender } = await render(Counter, { props: { step: 5 } });
	await rerender({ step: 10 });
	// The tap bubbles from the <text> to the button's handler.
	await fireEvent.tap(screen.getByText("Add 10"));
	expect(screen.getByText("Count: 10")).toBeTruthy();
});

it("renders without the first frame too", async () => {
	await render(Counter, { lynx: { firstFrame: false } });
	await fireEvent.tap(screen.getByText("Add 1"));
	expect(screen.getByText("Count: 1")).toBeTruthy();
});
