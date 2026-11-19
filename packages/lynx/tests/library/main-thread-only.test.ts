// `render(Component, { lynx: { background: false } })`: the first frame is drawn, and the background
// never starts. For a test of what the first frame draws.

import { expect, it } from "@rstest/core";
import { act, fireEvent, render, screen } from "@sohedra/lynx/testing";

import MainOnly from "../fixtures/library/MainOnly.svelte";
import MainThreadFunctions from "../fixtures/library/MainThreadFunctions.svelte";
import ModuleLevel from "../fixtures/library/ModuleLevel.svelte";

const FRAME_ONLY = { lynx: { background: false } };

it("draws the first frame from the main thread's copy, and stays there", async () => {
	await render(ModuleLevel, FRAME_ONLY);
	expect(screen.getByText("main thread")).toBeTruthy();
	// Time passes, and the background never comes.
	await act();
	expect(screen.getByText("main thread")).toBeTruthy();
	expect(screen.queryByText("background")).toBeNull();
});

it("gives the page and its queries", async () => {
	const { container, getByText, baseElement } = await render(MainOnly, FRAME_ONLY);
	expect(container.localName).toBe("page");
	expect(baseElement).toBe(document.body);
	expect(getByText("Count: 0")).toBeTruthy();
});

it("runs a main-thread handler, which the main thread alone runs", async () => {
	const { container } = await render(MainOnly, FRAME_ONLY);
	const g = globalThis as { mainThreadTaps?: number };
	g.mainThreadTaps = 0;
	await fireEvent.tap(container.querySelector(".fade")!);
	expect(g.mainThreadTaps).toBe(1);
});

it("says so when an event has a handler on the background", async () => {
	await render(MainOnly, FRAME_ONLY);
	await expect(fireEvent.tap(screen.getByText("Count: 0"))).rejects.toThrow(
		"has a handler on the background thread, which this page does not have",
	);
	expect(screen.getByText("Count: 0")).toBeTruthy();
});

it("says so for rerender, the component's exports and the host's messages", async () => {
	const page = await render(MainOnly, FRAME_ONLY);
	await expect(page.rerender({})).rejects.toThrow("no background thread, which rerender() needs");
	expect(() => page.component["anything"]).toThrow("no background thread");
	await expect(page.lynx.updateGlobalProps({})).rejects.toThrow("no background thread");
	await expect(page.lynx.sendHostEvent("anything")).rejects.toThrow("no background thread");
});

it("says so when a main-thread function calls a background function", async () => {
	const log: unknown[] = [];
	const { container } = await render(MainThreadFunctions, { props: { log }, ...FRAME_ONLY });
	await expect(fireEvent.tap(container.querySelector(".box")!)).rejects.toThrow(
		"no background thread, which a main-thread function's runOnBackground needs",
	);
	expect(log).toEqual([]);
});

it("is an error with firstFrame: false", async () => {
	await expect(
		render(MainOnly, { lynx: { background: false, firstFrame: false } }),
	).rejects.toThrow("its first frame alone, so it cannot also leave the first frame out");
});

it("lets the next test render a page, with the background", async () => {
	await render(MainOnly);
	await fireEvent.tap(screen.getByText("Count: 0"));
	expect(screen.getByText("Count: 1")).toBeTruthy();
});
