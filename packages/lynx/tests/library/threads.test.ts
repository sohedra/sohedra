// The first frame renders on the main thread, then the background takes over.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import Threads from "../fixtures/library/Threads.svelte";

it("renders the first frame on the main thread, then the background takes over", async () => {
	const seen: [string, boolean][] = [];
	await render(Threads, {
		props: { onrender: (thread: string, dev: boolean) => seen.push([thread, dev]) },
		lynx: { firstFrame: true },
	});
	expect(seen).toEqual([
		["main", true],
		["background", true],
	]);
	expect(screen.getByText("background")).toBeTruthy();
});

it("renders on the background alone by default", async () => {
	const seen: string[] = [];
	await render(Threads, { props: { onrender: (thread: string) => seen.push(thread) } });
	expect(seen).toEqual(["background"]);
});
