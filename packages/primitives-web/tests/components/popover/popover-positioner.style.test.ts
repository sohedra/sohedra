// Sohedra spec case: the positioner's style updates patch only the properties the library sets,
// so inline styles set by others survive.

import { describe, expect, it } from "vitest";

import { createRenderer, screen, waitFor } from "../../shim/index.js";
import StyleForeignPopover from "./fixtures/popover-style-foreign.svelte";

describe("<Popover.Positioner /> style", () => {
	const { render } = createRenderer();

	it("keeps an inline property set by others when its position updates", async () => {
		const { setProps } = await render(StyleForeignPopover, { sideOffset: 0 });
		// The position is a transform once positioned.
		const positioner = await waitFor(() => {
			const element = screen.getByTestId("positioner");
			expect(element.style.getPropertyValue("transform")).not.toBe("");
			return element;
		});
		const transform = positioner.style.getPropertyValue("transform");
		positioner.style.setProperty("--accent", "red");

		await setProps({ sideOffset: 20 });

		await waitFor(() => expect(positioner.style.getPropertyValue("transform")).not.toBe(transform));
		expect(positioner.style.getPropertyValue("--accent")).toBe("red");
	});
});
