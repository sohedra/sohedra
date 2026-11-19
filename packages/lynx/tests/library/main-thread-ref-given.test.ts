// `main-thread:ref` takes a ref made with `mainThreadRef()` or a main-thread function: a plain
// function there is an error that says what it takes.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";

import RefNotRef from "../fixtures/library/RefNotRef.svelte";

it("refuses a plain function as main-thread:ref, saying what it takes", async () => {
	await expect(render(RefNotRef, { props: { kind: "plain" } })).rejects.toThrow(
		/main-thread:ref is a plain function/,
	);
});

it("takes a ref", async () => {
	const { container } = await render(RefNotRef, { props: { kind: "ref" } });
	expect(container.querySelector(".box")).not.toBeNull();
});
