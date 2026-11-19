// What a static copy rests on: Svelte never looks inside the container. A copy sits in an element
// with siblings inside an `{#if}` and a keyed `{#each}`, and Svelte changes everything around it:
// the siblings' text, the rows reordered so that the container moves, and at last the block that
// holds it removed. After each step the page is right, and the copy is still inside.

import { expect, it } from "@rstest/core";
import { createStaticCopy } from "@sohedra/lynx";
import { act, render } from "@sohedra/lynx/testing";

import StaticCopyBlocks from "../fixtures/library/StaticCopyBlocks.svelte";

it("keeps the copy in its container while Svelte changes, moves and removes what is around it", async () => {
	// oxlint-disable-next-line typescript/no-explicit-any -- the fixture fills in the nodes
	const handles: Record<string, any> = {};
	const { container } = await render(StaticCopyBlocks, { props: { handles } });
	await act(() => createStaticCopy(handles.src, handles["row-b"]));
	const row = () => container.querySelector('[data-row="b"]')!;
	const copied = () => row().querySelector(".src-text")?.textContent;
	expect(copied()).toBe("one");

	await act(() => handles.api.setText("two"));
	expect(container.querySelector(".lead")!.textContent).toBe("two");
	expect(copied()).toBe("one");

	await act(() => handles.api.setRows(["c", "b", "a"]));
	const rows = [...container.querySelectorAll(".row")].map((each) => each.getAttribute("data-row"));
	expect(rows).toEqual(["c", "b", "a"]);
	expect(copied()).toBe("one");

	await act(() => handles.api.setShow(false));
	expect(container.querySelector(".block")).toBeNull();
});
