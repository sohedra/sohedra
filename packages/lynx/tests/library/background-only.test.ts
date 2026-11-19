// A module that imports `background-only` is a stub on the main thread: it works in `onMount`, and
// the first frame says where it was used.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import { sent } from "../fixtures/library/analytics.ts";
import Tracked from "../fixtures/library/Tracked.svelte";

it("works in onMount, with the first frame on", async () => {
	sent.length = 0;
	await render(Tracked, { lynx: { firstFrame: true } });
	expect(sent).toEqual(["mount"]);
	expect(screen.getByText("tracked")).toBeTruthy();
});

it("says what the first frame used, from where, when it renders with the module", async () => {
	await expect(
		render(Tracked, { props: { inMarkup: true }, lynx: { firstFrame: true } }),
	).rejects.toThrow(/sent.*analytics\.ts/s);
});
