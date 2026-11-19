// `main-thread:ref` given a main-thread function: it runs on the main thread with the element once
// the element is attached (in the first frame too), and what it returned runs when the element goes
// or the attribute changes, as an attachment's cleanup does.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import RefFunction from "../fixtures/library/RefFunction.svelte";

async function setup(
	props: { which?: "a" | "b" | "clean" | "quiet" | null; shown?: boolean } = {},
) {
	const log: unknown[] = [];
	const page = await render(RefFunction, { props: { log, ...props } });
	const box = () => page.container.querySelector(".box");
	return { ...page, log, box };
}

it("calls it with the element once the element is attached, seeing what it captured", async () => {
	const { log, box } = await setup();
	expect(log).toEqual(["ref a element"]);
	expect(box()!.getAttribute("seen-by")).toBe("a");
});

it("calls it in the first frame too, when that is all there is", async () => {
	const { container } = await render(RefFunction, {
		props: { log: [], which: "quiet" },
		lynx: { background: false },
	});
	expect(container.querySelector(".box")!.getAttribute("seen-by")).toBe("quiet");
});

it("does not call it again when the element is removed", async () => {
	const { log, rerender } = await setup();
	await rerender({ shown: false });
	expect(log).toEqual(["ref a element"]);
});

it("calls the new one with the element when it changes", async () => {
	const { log, rerender, box } = await setup();
	await rerender({ which: "b" });
	expect(log).toEqual(["ref a element", "ref b element"]);
	expect(box()!.getAttribute("seen-by")).toBe("b");
});

it("does not call it again when the attribute becomes null", async () => {
	const { log, rerender } = await setup();
	await rerender({ which: null });
	expect(log).toEqual(["ref a element"]);
});

it("runs what it returned when the element goes", async () => {
	const { log, rerender } = await setup({ which: "clean" });
	expect(log).toEqual(["ref clean element"]);
	await rerender({ shown: false });
	expect(log).toEqual(["ref clean element", "ref clean is over"]);
});

it("runs what it returned when it changes to another", async () => {
	const { log, rerender } = await setup({ which: "clean" });
	await rerender({ which: "a" });
	expect(log).toEqual(["ref clean element", "ref clean is over", "ref a element"]);
});
