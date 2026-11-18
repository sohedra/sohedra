// `value` on an input and a textarea, as on the web: the first value as `default-value`, typing
// into the state without an echo, and the state's changes written with `setValue`.

import { describe, expect, it } from "@rstest/core";

import Input from "../fixtures/threads/Input.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function input() {
	const page = startSveltePage(Input);
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const fire = (value: string, options: { isComposing?: boolean; selectionEnd?: number } = {}) =>
		page.engine.fire(page.byClass("field"), {
			type: "input",
			detail: { value, isComposing: options.isComposing ?? false, ...options },
		});
	const type = async (value: string, isComposing = false) => {
		fire(value, { isComposing });
		await page.settle();
	};
	const writes = (token: string) =>
		page.engine.invocations
			.filter((call) => call.method === "setValue" && call.element === page.byClass(token))
			.map((call) => call.params as Record<string, unknown>);
	const written = (token: string) => writes(token).map((params) => params["value"]);
	const echo = () => page.engine.text(page.byClass("echo"));
	return { page, tap, fire, type, writes, written, echo };
}

describe("value on an input", () => {
	it("starts the input from the state with default-value, without setValue", async () => {
		const { page, written } = await input();
		expect(page.engine.state(page.byClass("field")).attrs["default-value"]).toBe("hello");
		expect(page.engine.state(page.byClass("area")).attrs["default-value"]).toBe("hello");
		expect(written("field")).toEqual([]);
	});

	it("takes typing into the state, without writing it back", async () => {
		const { type, written, echo } = await input();
		await type("hello!");
		expect(echo()).toBe("hello!");
		expect(written("field")).toEqual([]);
		// The textarea shows the same state: it is written.
		expect(written("area")).toEqual(["hello!"]);
	});

	it("writes the state's changes to the input with setValue", async () => {
		const { tap, written } = await input();
		await tap("clear");
		expect(written("field")).toEqual([""]);
	});

	it("writes a change at once even while the keyboard composes, but not a setter's own change", async () => {
		const { tap, type, written } = await input();
		await tap("upper");
		expect(written("field")).toEqual(["HELLO"]);
		await type("HELLOa", true);
		// The setter makes it upper case: not written while composing.
		expect(written("field")).toEqual(["HELLO"]);
		await type("HELLOab", false);
		expect(written("field")).toEqual(["HELLO", "HELLOAB"]);
	});

	it("gives an input made in an update its value from the start, with no error", async () => {
		const { page, tap, written } = await input();
		await tap("later");
		expect(page.engine.state(page.byClass("made")).attrs["default-value"]).toBe("from the start");
		expect(written("made")).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("reports a setValue that fails into Lynx, naming the element", async () => {
		const { page, tap } = await input();
		page.engine.respondWith(() => ({ code: 4 }));
		await tap("clear");
		expect(page.errors).toEqual(
			["input", "textarea"].map((tag) =>
				expect.objectContaining({
					code: "input_value_not_written",
					message: expect.stringMatching(
						new RegExp(
							`^The value of the <${tag}> element could not be written: Lynx could not run setValue`,
						),
					),
				}),
			),
		);
	});
});

describe("a setter's answer to typing", () => {
	it("is dropped when the field had newer typing by the time it came, so no key is lost", async () => {
		const { page, tap, fire, written } = await input();
		await tap("upper");
		// Two keys before the background answers the first: its answer comes after the second.
		fire("HELLOa");
		fire("HELLOab");
		await page.settle();
		expect(written("field")).toEqual(["HELLO", "HELLOAB"]);
	});

	it("keeps the caret where the typing left it, moved by what the setter changed", async () => {
		const { tap, fire, page, writes } = await input();
		await tap("upper");
		fire("HxELLO", { selectionEnd: 2 });
		await page.settle();
		expect(writes("field").at(-1)).toEqual({ value: "HXELLO", cursor: 2 });
	});

	it("keeps the caret where it is when the setter changed only what follows it", async () => {
		const { tap, fire, page, writes } = await input();
		await tap("card");
		expect(writes("field").at(-1)).toEqual({ value: "1234 5678" });
		// 9 typed after `1234 `: the mask moves the space after 5678 to after 9567.
		fire("1234 95678", { selectionEnd: 6 });
		await page.settle();
		expect(writes("field").at(-1)).toEqual({ value: "1234 9567 8", cursor: 6 });
	});

	it("moves the caret past what the setter added at the caret or before it", async () => {
		const { tap, fire, page, writes } = await input();
		await tap("card");
		// 9 typed after `123`: the mask adds a space at the caret.
		fire("12394 5678", { selectionEnd: 4 });
		await page.settle();
		expect(writes("field").at(-1)).toEqual({ value: "1239 4567 8", cursor: 5 });
		// 5 typed at the end: the mask adds a space before it.
		fire("12345", { selectionEnd: 5 });
		await page.settle();
		expect(writes("field").at(-1)).toEqual({ value: "1234 5", cursor: 6 });
	});

	it("lets a change from code win over a key typed while it was on its way", async () => {
		const { page, fire, written, echo } = await input();
		// The tap reaches the background first, which clears the field before it hears the key.
		page.engine.dispatch(page.byClass("clear"), { type: "tap" });
		fire("hellox");
		await page.settle();
		expect(written("field")).toEqual([""]);
		// Lynx answers the write with an input event of the written value (Android), which the fake
		// does not send on its own.
		fire("");
		await page.settle();
		expect(written("field")).toEqual([""]);
		expect(echo()).toBe("");
	});

	it("writes no caret for a change from code", async () => {
		const { tap, writes } = await input();
		await tap("clear");
		expect(writes("field")).toEqual([{ value: "" }]);
	});

	it("held back while the keyboard composes is written when the field loses focus", async () => {
		const { page, tap, type, written } = await input();
		await tap("upper");
		await type("HELLOa", true);
		expect(written("field")).toEqual(["HELLO"]);
		page.engine.fire(page.byClass("field"), { type: "blur" });
		await page.settle();
		expect(written("field")).toEqual(["HELLO", "HELLOA"]);
	});

	it("held back while the keyboard composes is written with the next typing that does not", async () => {
		const { tap, type, written } = await input();
		await tap("upper");
		await type("HELLOa", true);
		// The same text, no longer composing: the state does not change, and the write still comes.
		await type("HELLOa", false);
		expect(written("field")).toEqual(["HELLO", "HELLOA"]);
	});
});
