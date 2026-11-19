// A component's module-level code reads the thread flags: each thread has its own copy of the
// module, as in a build, so the first frame shows the main thread's value and the background's
// takes its place at hydration.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import ModuleLevel from "../fixtures/library/ModuleLevel.svelte";

it("runs the module's top-level code once on each thread", () => {
	const loads = (globalThis as { moduleLevelLoads?: string[] }).moduleLevelLoads;
	expect([...(loads ?? [])].sort()).toEqual(["background", "main thread"]);
});

it("shows the main thread's value in the first frame and the background's after hydration", async () => {
	const seen: string[] = [];
	const observer = new MutationObserver(() => seen.push(document.body.textContent ?? ""));
	observer.observe(document.body, { childList: true, subtree: true, characterData: true });
	try {
		await render(ModuleLevel);
	} finally {
		observer.disconnect();
	}
	expect(seen[0]).toBe("main thread");
	expect(seen.at(-1)).toBe("background");
	expect(screen.getByText("background")).toBeTruthy();
});

it("shows the background's value with firstFrame: false", async () => {
	await render(ModuleLevel, { lynx: { firstFrame: false } });
	expect(screen.getByText("background")).toBeTruthy();
});
