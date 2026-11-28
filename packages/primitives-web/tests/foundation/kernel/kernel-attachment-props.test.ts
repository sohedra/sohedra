// attachmentProps: an attachment carried through a props spread, applied once while the props are
// built again, and removed when the element goes.
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

import AttachmentPropsElement from "./fixtures/kernel-attachment-props-element.svelte";

describe("attachmentProps", () => {
	it("applies its attachment through a spread, once, while the props are built again", async () => {
		const onattach = vi.fn();
		const ondetach = vi.fn();
		const screen = await render(AttachmentPropsElement, { label: "a", onattach, ondetach });
		const element = screen.getByTestId("element");
		await expect.element(element).toHaveAttribute("aria-label", "a");
		expect(onattach).toHaveBeenCalledTimes(1);

		await screen.rerender({ label: "b" });
		await expect.element(element).toHaveAttribute("aria-label", "b");
		expect(onattach).toHaveBeenCalledTimes(1);
		expect(ondetach).not.toHaveBeenCalled();

		await screen.unmount();
		expect(ondetach).toHaveBeenCalledTimes(1);
	});
});
