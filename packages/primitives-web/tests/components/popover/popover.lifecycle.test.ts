// Popover over time once the app closes it or the Root unmounts: hover opens it again, and no timer
// acts late. Fake timers with real frames (async mode needs them); DOM state is read with a plain
// `expect` after `settle()`, since `expect.element` retries by advancing fake time.
import { REASONS } from "@sohedra/primitives-core/foundation/kernel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands, page, userEvent } from "vitest/browser";

import { dispatch } from "../../kit/kit-events.js";
import { settle } from "../../kit/kit-frames.js";
import PopoverAppOpen from "./fixtures/popover-app-open.svelte";
import PopoverDemo from "./fixtures/popover-demo.svelte";

const DELAY = 100;

function useFakeTime() {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
		});
	});
	afterEach(() => {
		vi.useRealTimers();
	});
}

/** Lets `ms` of fake time pass, then applies Svelte's updates. */
async function rest(ms: number) {
	vi.advanceTimersByTime(ms);
	await settle();
}

/**
 * Fake time: Vitest advances fake timers by 50 ms for every 50 ms a real input takes, so a case that
 * times an input to within a delay sends the pointer's events itself, at the fake time it means.
 */
function fakeHover(element: Element) {
	dispatch(element, "pointerenter", { pointerType: "mouse" });
	dispatch(element, "mouseenter");
	dispatch(element, "mousemove", { movementX: 10, movementY: 10 });
}

/** The real pointer leaves for the page's top-left corner, away from every popup. */
async function away() {
	await commands.parkPointer();
	await settle();
}

const popup = () => page.getByTestId("popup").query();

describe("Popover.Root closed by the app, with openOnHover", () => {
	useFakeTime();

	async function setup(props: { keepMounted?: boolean; closeDelay?: number } = {}) {
		const onOpenChange = vi.fn();
		const screen = await render(PopoverAppOpen, {
			triggerProps: { delay: DELAY, closeDelay: props.closeDelay ?? 0 },
			keepMounted: props.keepMounted ?? false,
			onOpenChange,
		});
		const trigger = page.getByRole("button", { name: "Trigger" });
		const setOpen = async (open: boolean) => {
			screen.component.setOpen(open);
			await settle();
		};
		return { trigger, setOpen, onOpenChange };
	}

	it("opens on hover again after a click-opened popover was closed by the app", async () => {
		const { trigger } = await setup();

		await userEvent.click(trigger);
		await settle();
		expect(popup()).not.toBe(null);

		// Held open by the click: the pointer leaves and it stays.
		await away();
		await rest(DELAY);
		expect(popup()).not.toBe(null);

		await userEvent.click(page.getByRole("button", { name: "Done" }));
		await settle();
		expect(popup()).toBe(null);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");

		await away();
		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(popup()).not.toBe(null);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
	});

	it("opens on hover again after a click pinned a hover-opened popover and the app closed it", async () => {
		const { trigger, onOpenChange } = await setup();

		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(popup()).not.toBe(null);

		// An impatient click keeps it open and pins it.
		await userEvent.click(trigger);
		await settle();
		await away();
		await rest(DELAY);
		expect(popup()).not.toBe(null);

		await userEvent.click(page.getByRole("button", { name: "Done" }));
		await settle();
		expect(popup()).toBe(null);

		onOpenChange.mockClear();
		await away();
		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(popup()).not.toBe(null);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
	});

	it("opens on hover after each close by the app, not only the first", async () => {
		const { trigger, setOpen } = await setup();

		await userEvent.click(trigger);
		await settle();
		await setOpen(false);
		await away();

		for (let round = 0; round < 2; round += 1) {
			await userEvent.hover(trigger);
			await rest(DELAY);
			expect(popup()).not.toBe(null);
			await away();
			await setOpen(false);
			expect(popup()).toBe(null);
		}
	});

	it("doesn't reopen a kept-mounted popover when the app closes it while a hover open is pending", async () => {
		const { trigger, setOpen, onOpenChange } = await setup({ keepMounted: true });

		// The pointer rests on the trigger; before the rest ends the app opens and closes the popover.
		// Fake time: the app acts 40 ms into the 100 ms delay.
		fakeHover(trigger.element());
		await rest(DELAY - 60);
		await setOpen(true);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
		await setOpen(false);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");

		await rest(DELAY * 3);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("reports no late hover close after the app closed a kept-mounted popover", async () => {
		const { trigger, setOpen, onOpenChange } = await setup({ keepMounted: true, closeDelay: 100 });

		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// The pointer leaves: the close waits for its delay. The app closes the popover meanwhile.
		await away();
		await rest(40);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
		await setOpen(false);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");

		await rest(300);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
	});

	it("reports no hover close when the pointer leaves a kept-mounted popover the app closed under it", async () => {
		const { trigger, onOpenChange } = await setup({ keepMounted: true });

		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// The pointer travels into the popup and presses the button that closes it.
		await userEvent.click(page.getByRole("button", { name: "Done" }));
		await settle();
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");

		// The closed popup no longer takes the pointer, which then leaves it.
		await away();
		await rest(300);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
	});

	it("keeps a click-opened popover pinned after the app closed and reopened it", async () => {
		const { trigger, setOpen } = await setup({ keepMounted: true });

		await userEvent.click(trigger);
		await settle();
		await setOpen(false);
		await setOpen(true);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");

		// Open again and still held by its click: hovering in and out doesn't close it.
		await away();
		await userEvent.hover(trigger);
		await away();
		await rest(300);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
	});

	it("stays closed while the pointer rests on the trigger after the app closed a hover-opened popover", async () => {
		const { trigger, setOpen, onOpenChange } = await setup();

		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");

		await setOpen(false);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");
		onOpenChange.mockClear();

		// The pointer never leaves: moves over the trigger, without a new enter, don't reopen it.
		await userEvent.hover(trigger, { position: { x: 2, y: 2 } });
		await rest(DELAY);
		await userEvent.hover(trigger, { position: { x: 4, y: 4 } });
		await rest(DELAY);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "false");
		expect(onOpenChange).not.toHaveBeenCalled();

		// Leaving and coming back opens it.
		await away();
		await userEvent.hover(trigger);
		await rest(DELAY);
		expect(trigger.element()).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
	});
});

describe("Popover timers after the Root unmounts", () => {
	useFakeTime();

	it("doesn't open after the Root unmounts during the hover delay", async () => {
		const onOpenChange = vi.fn();
		const screen = await render(PopoverDemo, {
			rootProps: { onOpenChange },
			triggers: ["Trigger"],
			triggerProps: { openOnHover: true, delay: 100 },
		});

		// Fake time: the Root goes 50 ms into the 100 ms delay.
		fakeHover(page.getByRole("button", { name: "Trigger" }).element());
		await rest(50);
		await screen.rerender({ show: false });
		await rest(200);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("doesn't open a removed Root from a detached trigger's pending hover", async () => {
		const onOpenChange = vi.fn();
		const screen = await render(PopoverDemo, {
			variant: "detached",
			rootProps: { onOpenChange },
			triggers: ["Trigger"],
			triggerProps: { openOnHover: true, delay: 100 },
		});

		// Fake time: the Root goes 50 ms into the 100 ms delay.
		fakeHover(page.getByRole("button", { name: "Trigger" }).element());
		await rest(50);
		await screen.rerender({ show: false });
		await rest(200);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("doesn't close after the Root unmounts during the close delay", async () => {
		const onOpenChange = vi.fn();
		const screen = await render(PopoverDemo, {
			variant: "detached",
			rootProps: { onOpenChange },
			triggers: ["Trigger"],
			triggerProps: { openOnHover: true, delay: 0, closeDelay: 100 },
		});

		await userEvent.hover(page.getByRole("button", { name: "Trigger" }));
		await rest(0);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

		// Leaves away from the popup: the safe polygon closes after the close delay.
		await away();
		await rest(50);
		await screen.rerender({ show: false });
		await rest(200);

		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});
});
