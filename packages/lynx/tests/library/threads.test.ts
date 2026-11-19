// The first frame renders on the main thread, then the background takes over.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import Threads from "../fixtures/library/Threads.svelte";

it("renders the first frame on the main thread, then the background takes over", async () => {
	const seen: [string, boolean][] = [];
	await render(Threads, {
		props: { onrender: (thread: string, dev: boolean) => seen.push([thread, dev]) },
	});
	expect(seen).toEqual([
		["main", true],
		["background", true],
	]);
	expect(screen.getByText("background")).toBeTruthy();
});

it("renders on the background only with firstFrame: false", async () => {
	const seen: string[] = [];
	await render(Threads, {
		props: { onrender: (thread: string) => seen.push(thread) },
		lynx: { firstFrame: false },
	});
	expect(seen).toEqual(["background"]);
});
