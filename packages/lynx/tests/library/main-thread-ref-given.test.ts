// `main-thread:ref` takes a ref made with `mainThreadRef()` or a main-thread function; anything else
// is an error that says what it takes, as ReactLynx's is.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import RefNotRef from "../fixtures/library/RefNotRef.svelte";

it("refuses a plain function as main-thread:ref, saying what it takes", async () => {
	await expect(render(RefNotRef, { props: { kind: "plain" } })).rejects.toThrow(
		/main-thread:ref is a plain function/,
	);
});

it.each([
	// Quoted: a text that is a phrase, or empty, reads apart from the message's own words.
	["text", 'the string "not a ref"'],
	["empty text", 'the string ""'],
	["object", "an object"],
	["number", "the number 3"],
])("refuses %s as main-thread:ref, saying what it takes", async (kind, said) => {
	await expect(render(RefNotRef, { props: { kind } })).rejects.toThrow(
		`The <view>'s main-thread:ref is ${said}, which is neither a ref nor a main-thread function`,
	);
});

it("takes a ref", async () => {
	const { container } = await render(RefNotRef, { props: { kind: "ref" } });
	expect(container.querySelector(".box")).not.toBeNull();
});
