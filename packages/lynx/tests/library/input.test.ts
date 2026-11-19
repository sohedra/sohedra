// An `<input>` starts from the state, takes typing without writing it back, and gets what a setter
// changed, but not while the text is being composed.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";
import type { TestLynx } from "@sohedra/lynx/testing";

import Input from "../fixtures/library/Input.svelte";

const setValues = (lynx: TestLynx) =>
	lynx.invocations.filter((call) => call.method === "setValue").map((call) => call.params);

it("starts the input from the state, takes typing without echoing it, and writes state changes", async () => {
	const { container, lynx } = await render(Input);
	const byClass = (name: string) => container.querySelector(`.${name}`)!;
	expect(byClass("field").getAttribute("default-value")).toBe("hello");

	await fireEvent.input(byClass("field"), { detail: { value: "hello w" } });
	expect(byClass("echo").textContent).toBe("hello w");
	expect(setValues(lynx)).toEqual([]);

	await fireEvent.tap(byClass("clear"));
	expect(byClass("echo").textContent).toBe("");
	expect(setValues(lynx)).toEqual([{ value: "" }]);
});

it("writes back what a setter changed, but not while composing", async () => {
	const { container, lynx } = await render(Input);
	const field = container.querySelector(".upper-field")!;
	await fireEvent.input(field, { detail: { value: "ç", isComposing: true } });
	expect(setValues(lynx)).toEqual([]);
	await fireEvent.input(field, { detail: { value: "çok", isComposing: false } });
	expect(setValues(lynx)).toEqual([{ value: "ÇOK" }]);
});
