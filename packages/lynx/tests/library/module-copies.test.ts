// A plain `.ts` module a component imports has a copy for each thread: its state is not shared
// between the first frame and the app.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import Counted from "../fixtures/library/Counted.svelte";
import { next } from "../fixtures/library/counted.ts";

it("loads the module once for each thread", () => {
	const loads = (globalThis as { countedLoads?: string[] }).countedLoads;
	expect([...(loads ?? [])].sort()).toEqual(["background", "main thread"]);
});

it("gives each thread's component its own state", async () => {
	await render(Counted);
	// Each copy counted one call, not two.
	expect(screen.getByText("background 1")).toBeTruthy();
});

it("shares the background's copy with the test file, and not the main thread's", () => {
	// The component's background render made the first call on this copy.
	expect(next()).toBe(2);
});
