// What `render` gives besides the page: the contexts it mounts with, the component's exports, a way
// to print the page, and the page ending after each test.

import { expect, it, rs } from "@rstest/core";
import { act, cleanup, fireEvent, render, screen } from "@sohedra/lynx/testing";

import RefFunction from "../fixtures/library/RefFunction.svelte";
import Themed from "../fixtures/library/Themed.svelte";

it("mounts with the contexts it is given, in the first frame and on the background", async () => {
	await render(Themed, { context: new Map([["theme", "dark"]]), lynx: { background: false } });
	expect(screen.getByText("dark 0")).toBeTruthy();
	cleanup();
	await render(Themed, { context: new Map([["theme", "light"]]) });
	expect(screen.getByText("light 0")).toBeTruthy();
});

it("gives the component's exports, which change the page through act", async () => {
	const { component } = await render(Themed);
	const exports = component as unknown as { bump(): number };
	expect(await act(() => exports.bump())).toBe(1);
	expect(screen.getByText("no theme 1")).toBeTruthy();
});

it("prints the page", async () => {
	const log = rs.spyOn(console, "log").mockImplementation(() => {});
	try {
		const { debug } = await render(Themed);
		debug();
		expect(String(log.mock.calls[0]?.[0])).toContain("no theme 0");
	} finally {
		log.mockRestore();
	}
});

it("resolves when a main-thread function of the first frame calls the background", async () => {
	const log: unknown[] = [];
	await render(RefFunction, { props: { log }, lynx: { firstFrame: true } });
	expect(log).toEqual(["ref a element"]);
});

it("ends the page with cleanup, after which an event has no page to go to", async () => {
	await render(Themed);
	const text = screen.getByText("no theme 0");
	cleanup();
	expect(text.isConnected).toBe(false);
	await expect(fireEvent.tap(text)).rejects.toThrow(
		"Nothing is rendered, so fireEvent has no page",
	);
	expect(await act(() => "no page")).toBe("no page");
});

it("says the page has ended to a call that would change it", async () => {
	const { rerender, lynx, unmount } = await render(Themed);
	cleanup();
	await expect(rerender({})).rejects.toThrow("Nothing is rendered, so rerender() has no page");
	await expect(lynx.reload()).rejects.toThrow("Nothing is rendered, so lynx.reload() has no page");
	await expect(lynx.sendHostEvent("anything")).rejects.toThrow(
		"Nothing is rendered, so lynx.sendHostEvent() has no page",
	);
	await expect(lynx.updateInitData({})).rejects.toThrow("lynx.updateInitData() has no page");
	await expect(lynx.updateGlobalProps({})).rejects.toThrow("lynx.updateGlobalProps() has no page");
	expect(() => lynx.gesture(document.body)).toThrow("lynx.gesture() has no page");
	await unmount();
});
