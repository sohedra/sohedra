// An action with `use:` works on Lynx: it gets the element's node once the element is made, its
// `update` hears a new parameter, and its `destroy` runs when the element goes.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import Attached from "../fixtures/library/Attached.svelte";

it("runs on the node, follows its parameter, and ends with the element", async () => {
	const log: unknown[] = [];
	const { container, rerender } = await render(Attached, { props: { log } });
	const box = () => container.querySelector(".box");
	expect(log).toEqual(["made view first"]);
	expect(box()!.getAttribute("marked")).toBe("first");

	await rerender({ label: "second" });
	expect(log).toEqual(["made view first", "update second"]);
	expect(box()!.getAttribute("marked")).toBe("second");

	await rerender({ shown: false });
	expect(log).toEqual(["made view first", "update second", "destroy"]);
	expect(box()).toBeNull();
});

it("leaves the first frame's element alone: the action runs on the background", async () => {
	const log: unknown[] = [];
	const { container } = await render(Attached, { props: { log }, lynx: { background: false } });
	expect(log).toEqual([]);
	expect(container.querySelector(".box")!.hasAttribute("marked")).toBe(false);
});
