// `createStaticCopy` in a component library's tests: a copy of drawn elements, as they are at the
// call, put into an empty element Svelte rendered. The thread tests cover each part of the copy;
// these check it through the public library.

import { expect, it } from "@rstest/core";
import { createStaticCopy } from "@sohedra/lynx";
import type { StaticCopy } from "@sohedra/lynx";
import { act, fireEvent, render, screen } from "@sohedra/lynx/testing";

import StaticCopySource from "../fixtures/library/StaticCopySource.svelte";

async function setup(props: Record<string, unknown> = {}) {
	// oxlint-disable-next-line typescript/no-explicit-any -- the fixture fills in the nodes
	const handles: Record<string, any> = { taps: 0 };
	const page = await render(StaticCopySource, { props: { handles, ...props } });
	const dom = (selector: string) => page.container.querySelector(selector)!;
	return { ...page, handles, dom };
}

it("copies an element with what is under it, as it is at the call", async () => {
	const { handles, dom, rerender } = await setup();
	const copy = (await act(() => createStaticCopy(handles.source, handles.holder)))!;
	expect(copy.nodes.map((node) => node.tag)).toEqual(["view"]);
	const copied = dom(".holder").children[0]!;
	expect(copied.getAttribute("class")).toBe(dom(".source").getAttribute("class"));
	expect(copied.getAttribute("style")).toContain("width");
	expect(copied.textContent).toBe("TitleDeep");
	expect(screen.getAllByText("Title")).toHaveLength(2);
	await rerender({ tone: "loud" });
	expect(dom(".source").getAttribute("data-tone")).toBe("loud");
	expect(copied.getAttribute("data-tone")).toBe("calm");
});

it("leaves out listeners and ids: a tap on the copy reaches no handler", async () => {
	const { handles, dom } = await setup();
	await act(() => createStaticCopy(handles.source, handles.holder));
	await fireEvent.tap(dom(".source"));
	expect(handles.taps).toBe(1);
	const copied = dom(".holder").children[0]!;
	await fireEvent.tap(copied);
	expect(handles.taps).toBe(1);
	expect(copied.hasAttribute("id")).toBe(false);
	expect(copied.querySelector(".inner")!.hasAttribute("id")).toBe(false);
});

it("keeps ids with keepIds, and remove() takes the copy out, once", async () => {
	const { handles, dom } = await setup();
	let copy: StaticCopy | undefined;
	await act(() => {
		copy = createStaticCopy(handles.source, handles.holder, { keepIds: true });
	});
	expect(dom(".holder").children[0]!.getAttribute("id")).toBe("source");
	await act(() => copy!.remove());
	expect(dom(".holder").children).toHaveLength(0);
	await act(() => copy!.remove());
	expect(dom(".holder").children).toHaveLength(0);
});
