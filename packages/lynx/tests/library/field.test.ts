// A headless field puts the rest of its props on its element, and follows them.

import { expect, it } from "@rstest/core";
import { render, screen } from "@sohedra/lynx/testing";

import Field from "../fixtures/library/Field.svelte";

it("puts the rest of its props on the element", async () => {
	const { rerender } = await render(Field, {
		props: {
			label: "Name",
			id: "name",
			"data-testid": "field",
			"accessibility-label": "Your name",
			"data-index": 2,
		},
	});
	const field = screen.getByTestId("field");
	expect(field.id).toBe("name");
	expect(field.getAttribute("accessibility-label")).toBe("Your name");
	expect(field.dataset["index"]).toBe("2");
	expect(field.className).toBe("field");
	expect(screen.getByText("Name").parentElement).toBe(field);

	await rerender({ "accessibility-label": "Full name" });
	expect(field.getAttribute("accessibility-label")).toBe("Full name");
});
