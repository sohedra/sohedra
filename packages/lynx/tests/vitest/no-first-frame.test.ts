// Parity row: `svelteLynx({ firstFrame: false })` gives no component a first-frame copy.

import { render, screen } from "@sohedra/lynx/testing";
import { expect, it } from "vitest";

import Counter from "../fixtures/library/Counter.svelte";

it("renders on the background alone", async () => {
	await render(Counter);
	expect(screen.getByText("Count: 0")).toBeTruthy();
});

it("says so when the first frame is asked for, naming the Vitest preset", async () => {
	await expect(render(Counter, { lynx: { firstFrame: true } })).rejects.toThrow(
		/has no first-frame copy.*svelteLynx\(\) from @sohedra\/lynx\/config\/vitest/s,
	);
});
