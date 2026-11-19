// Parity rows: each thread's copy reads its own `define` constants; TypeScript is stripped by
// Vite's compiler, with a rune class's field kept a field.

import { fireEvent, render, screen } from "@sohedra/lynx/testing";
import { expect, it } from "vitest";

import Define from "./fixtures/Define.svelte";
import Typed from "./fixtures/Typed.svelte";

it("replaces the app's constants in each thread's copy, as `define` says", async () => {
	const seen: string[] = [];
	await render(Define, { props: { onrender: (thread: string) => seen.push(thread) } });
	expect(seen).toEqual(["from the main thread", "from the background"]);
	expect(screen.getByText("from the background")).toBeTruthy();
});

it("strips TypeScript from components and rune modules, keeping a class's state field", async () => {
	await render(Typed, { props: { step: 2 } });
	await fireEvent.tap(screen.getByText("Count: 0"));
	expect(screen.getByText("Count: 2")).toBeTruthy();
});
