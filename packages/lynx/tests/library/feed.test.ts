// A native list builds a row when Lynx shows it, and the row's handlers run.

import { expect, it } from "@rstest/core";
import { fireEvent, render, screen, within } from "@sohedra/lynx/testing";

import Feed from "../fixtures/library/Feed.svelte";

it("builds a cell when the list shows it, and runs its handlers", async () => {
	const { container, lynx } = await render(Feed, { props: { rows: ["a", "b", "c"] } });
	const list = container.querySelector("list")!;

	const cell = lynx.list(list).show(1);
	expect(cell.localName).toBe("list-item");
	expect(within(cell).getByText("b")).toBeTruthy();

	await fireEvent.tap(within(cell).getByText("b"));
	expect(screen.getByText("Picked: b")).toBeTruthy();

	// Handed back, the cell stays for reuse; the list asks again for another item.
	lynx.list(list).hide(cell);
	expect(within(lynx.list(list).show(2)).getByText("c")).toBeTruthy();
});

it("refuses an element that is not a list", async () => {
	const { container, lynx } = await render(Feed, { props: { rows: [] } });
	expect(() => lynx.list(container.querySelector("text")!)).toThrow(
		"A <text> was given to lynx.list, which drives a <list>.",
	);
});
