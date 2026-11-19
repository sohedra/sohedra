// The Vitest preset reads Svelte's output as the build does, as JavaScript: a component without
// `lang="ts"` and its rune module, and a `lang="ts"` component, whose main-thread function runs
// without its types. Each first frame too.

import { fireEvent, render, screen } from "@sohedra/lynx/testing";
import { expect, it } from "vitest";

import Compare from "../fixtures/threads/Compare.svelte";
import TsCompare from "../fixtures/threads/TsCompare.svelte";

it("reads a JavaScript component and its rune module as JavaScript, on both threads", async () => {
	await render(Compare, { lynx: { firstFrame: true } });
	expect(screen.getAllByText("true true true true")).toHaveLength(2);
});

it("reads a TypeScript component's output as JavaScript, and runs its main-thread function", async () => {
	const { container } = await render(TsCompare, { lynx: { firstFrame: true } });
	expect(screen.getByText("typescript true true true")).toBeTruthy();
	await fireEvent.tap(container.querySelector(".press")!);
	expect(screen.getByText("pressed 3")).toBeTruthy();
});
