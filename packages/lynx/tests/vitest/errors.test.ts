// Parity row: what Svelte or the build refuses is the build's message, at its place in the file.

import { expect, it } from "vitest";

it("explains a banned binding with the build's text", async () => {
	const error = await import("./fixtures/BannedBind.svelte").then(
		() => undefined,
		(thrown: Error) => thrown,
	);
	expect(error?.message).toMatch(/BannedBind\.svelte/);
	expect(error?.message).toContain("`bind:value` is not available");
	expect(error?.message).toContain("https://sohedra.com/e/");
});
