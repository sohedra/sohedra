// Timers a popover starts must not outlive it. The Root's teardown disposes the shared hover state.

import { describe, expect, it, vi } from "vitest";

import { createRenderer, fireEvent, screen } from "../../shim/index.js";
import LifetimePopover from "./fixtures/popover-lifetime.svelte";

function hover(element: HTMLElement) {
	fireEvent.pointerEnter(element, { pointerType: "mouse" });
	fireEvent.mouseEnter(element);
	fireEvent.mouseMove(element);
}

describe("Popover timers after unmount", () => {
	const { render, clock } = createRenderer();
	clock.withFakeTimers();

	it("doesn't open after the Root unmounts during the hover delay", async () => {
		const onOpenChange = vi.fn();
		const { setProps } = await render(LifetimePopover, {
			rootProps: { onOpenChange },
			triggerProps: { openOnHover: true, delay: 100 },
		});

		hover(screen.getByRole("button"));
		clock.tick(50);
		await setProps({ show: false });
		clock.tick(200);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("doesn't open a removed Root from a detached trigger's pending hover", async () => {
		const onOpenChange = vi.fn();
		const { setProps } = await render(LifetimePopover, {
			detached: true,
			rootProps: { onOpenChange },
			triggerProps: { openOnHover: true, delay: 100 },
		});

		hover(screen.getByRole("button"));
		clock.tick(50);
		await setProps({ show: false });
		clock.tick(200);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("doesn't close after the Root unmounts during the close delay", async () => {
		const onOpenChange = vi.fn();
		const { setProps } = await render(LifetimePopover, {
			detached: true,
			rootProps: { onOpenChange },
			triggerProps: { openOnHover: true, delay: 0, closeDelay: 100 },
		});

		const trigger = screen.getByRole("button");
		hover(trigger);
		clock.tick(0);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

		// Leaves away from the popup: the safe polygon closes after the close delay.
		fireEvent.mouseLeave(trigger, { clientX: -100, clientY: -100, relatedTarget: document.body });
		clock.tick(50);
		await setProps({ show: false });
		clock.tick(200);

		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});
});
