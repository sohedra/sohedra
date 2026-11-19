// The host's events: what it sends the page (the keyboard, the window's size, anything an app
// defines), heard with `on(host, …)` and sent in a test with `lynx.sendHostEvent`.

import { expect, it, rs } from "@rstest/core";
import { host } from "@sohedra/lynx/host";
import { act, render, screen } from "@sohedra/lynx/testing";
import { on } from "svelte/events";

import Heard from "../fixtures/library/Heard.svelte";

it("passes an event's arguments to the listener of an effect", async () => {
	const { lynx } = await render(Heard);
	await lynx.sendHostEvent("keyboardstatuschanged", ["on", 300]);
	expect(screen.getByText('["on",300]')).toBeTruthy();
	await lynx.sendHostEvent("keyboardstatuschanged", ["off", 0]);
	expect(screen.getByText('["on",300] ["off",0]')).toBeTruthy();
});

it("hears only the event it names", async () => {
	const { lynx, container } = await render(Heard);
	await lynx.sendHostEvent("exposure", [{ id: "a" }]);
	expect(container.textContent).toBe("");
});

it("stops listening when the effect runs again, and listens to the new name", async () => {
	const { lynx, rerender, container } = await render(Heard, { props: { name: "first" } });
	await rerender({ name: "second" });
	await lynx.sendHostEvent("first", [1]);
	expect(container.textContent).toBe("");
	await lynx.sendHostEvent("second", [2]);
	expect(screen.getByText("[2]")).toBeTruthy();
});

it("gives back a function that removes the listener", async () => {
	const { lynx } = await render(Heard);
	const heard = rs.fn();
	const off = (await act(() => on(host, "back", heard)))!;
	await lynx.sendHostEvent("back", ["once"]);
	expect(heard).toHaveBeenCalledTimes(1);
	expect(heard).toHaveBeenCalledWith("once");
	await act(() => {
		off();
		off();
	});
	await lynx.sendHostEvent("back", ["again"]);
	expect(heard).toHaveBeenCalledTimes(1);
});

it("reports a listener that throws, and still runs the others", async () => {
	const { lynx } = await render(Heard);
	const after = rs.fn();
	await act(() => {
		on(host, "back", () => {
			throw new Error("listener failed");
		});
		on(host, "back", after);
	});
	// The test library fails the test with what the page reported.
	await expect(lynx.sendHostEvent("back")).rejects.toThrow("listener failed");
	expect(after).toHaveBeenCalledTimes(1);
});

it("reports each listener that throws, together", async () => {
	const { lynx } = await render(Heard);
	await act(() => {
		on(host, "back", () => {
			throw new Error("first failed");
		});
		on(host, "back", () => {
			throw new Error("second failed");
		});
	});
	await expect(lynx.sendHostEvent("back")).rejects.toThrow(AggregateError);
});
