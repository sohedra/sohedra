// The page's root in a component library's tests: a listener on it hears an event fired on any
// element of the page, the layers mounted with `mount()` included, with the nodes as targets.

import { expect, it } from "@rstest/core";
import { root } from "@sohedra/lynx";
import type { LynxNode } from "@sohedra/lynx/elements";
import { act, fireEvent, render, screen } from "@sohedra/lynx/testing";
import { on } from "svelte/events";

import Touchable from "../fixtures/library/Touchable.svelte";

interface Heard {
	type: string;
	target: LynxNode;
	currentTarget: LynxNode;
}

const TOUCHES = ["touchstart", "touchmove", "touchend", "tap"] as const;

it("hears the touches of the page and of a layer, with the nodes as targets", async () => {
	// oxlint-disable-next-line typescript/no-explicit-any -- the fixture fills in the nodes
	const handles: Record<string, any> = {};
	await render(Touchable, { props: { handles } });
	const heard: Heard[] = [];
	let offs: (() => void)[] = [];
	await act(() => {
		offs = TOUCHES.map((type) =>
			on(root, type, (event: Heard) => heard.push(event), { capture: true }),
		);
	});

	for (const type of TOUCHES) await fireEvent[type](screen.getByText("Plain"));
	expect(heard.map((event) => event.type)).toEqual([...TOUCHES]);
	for (const event of heard) expect(event.target).toBe(handles.plain);

	await fireEvent.tap(screen.getByText("Open"));
	heard.length = 0;
	await fireEvent.tap(screen.getByText("Inside"));
	expect(heard).toHaveLength(1);
	expect(heard[0]!.target).toBe(handles.inside);

	// A catch below does not stop it in the capture phase; removing the listeners takes it off.
	heard.length = 0;
	await fireEvent.tap(screen.getByText("Caught"));
	expect(heard.map((event) => event.type)).toEqual(["tap"]);
	await act(() => {
		for (const off of offs) off();
	});
	heard.length = 0;
	await fireEvent.tap(screen.getByText("Plain"));
	expect(heard).toEqual([]);
});

it("gives a handler the node an attachment got as the current target", async () => {
	// oxlint-disable-next-line typescript/no-explicit-any -- the fixture fills in the nodes
	const handles: Record<string, any> = {};
	await render(Touchable, { props: { handles } });
	const seen: Heard[] = [];
	await act(() => on(handles.page, "tap", (event: Heard) => seen.push(event)));
	await fireEvent.tap(screen.getByText("Plain"));
	expect(seen).toHaveLength(1);
	expect(seen[0]!.target).toBe(handles.plain);
	expect(seen[0]!.currentTarget).toBe(handles.page);
});
