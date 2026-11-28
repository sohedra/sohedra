// Popover's hover-opening triggers over time. The real pointer runs under fake timers with real
// frames (async mode needs them); DOM state is read with a plain `expect` once Svelte has settled,
// since `expect.element` retries by advancing fake time.
import { REASONS } from "@sohedra/primitives-core/foundation/kernel";
import { PATIENT_CLICK_THRESHOLD } from "@sohedra/primitives-core/popover";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands, type Locator, page, userEvent } from "vitest/browser";

import { Popover } from "#lib/components/popover/index.js";

import { dispatch } from "../../kit/kit-events.js";
import { settle } from "../../kit/kit-frames.js";
import PopoverAppOpen from "./fixtures/popover-app-open.svelte";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverHandleMove from "./fixtures/popover-handle-move.svelte";
import PopoverHoverTriggers from "./fixtures/popover-hover-triggers.svelte";

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

/** The fake-time counterpart of `away`: the pointer leaves `element` away from the popup. */
function fakeLeave(element: Element) {
	dispatch(element, "mouseleave", { clientX: -100, clientY: -100, relatedTarget: document.body });
}

/** The real pointer leaves for the page's top-left corner, away from every popup. */
async function away() {
	await commands.parkPointer();
	await settle();
}

const popup = () => page.getByTestId("popup").query();

describe("Popover.Trigger with openOnHover", () => {
	useFakeTime();

	describe("after a press", () => {
		// No browser here emulates a touch pointer: the press is dispatched with its pointer type.
		function touchPress(trigger: Element) {
			dispatch(trigger, "pointerdown", { pointerType: "touch" });
			dispatch(trigger, "mousedown");
			dispatch(trigger, "click", { detail: 1 });
		}

		// A touch tap leaves the pointer parked wherever the cursor happens to be, so hover must stay
		// disarmed until the popover is reopened by some other means. Otherwise a stray hover over a
		// sibling trigger silently swaps the content the user just tapped for.
		it("keeps ownership on the tapped trigger when a sibling trigger is hovered", async () => {
			await render(PopoverHoverTriggers, { labels: ["One", "Two"] });

			const one = page.getByRole("button", { name: "One" });
			const two = page.getByRole("button", { name: "Two" });

			touchPress(one.element());
			await settle();

			expect(page.getByTestId("content").element()).toHaveTextContent("One");

			await userEvent.hover(two);
			await settle();

			expect(page.getByTestId("content").element()).toHaveTextContent("One");
			expect(two.element()).toHaveAttribute("aria-expanded", "false");
		});

		// The same hover must still take over when the popover was opened with a mouse, so the guard
		// above can't be a blanket disable.
		it("hands ownership to a hovered sibling trigger when opened by mouse", async () => {
			await render(PopoverHoverTriggers, { labels: ["One", "Two"] });

			const one = page.getByRole("button", { name: "One" });
			const two = page.getByRole("button", { name: "Two" });

			await userEvent.click(one);
			await settle();

			expect(page.getByTestId("content").element()).toHaveTextContent("One");

			await userEvent.hover(two);
			await settle();

			expect(page.getByTestId("content").element()).toHaveTextContent("Two");
			expect(two.element()).toHaveAttribute("aria-expanded", "true");
		});
	});

	describe("impatient clicks", () => {
		it("closes the popover if the user clicks patiently", async () => {
			await render(PopoverDemo, { triggerProps: { delay: 0, openOnHover: true } });

			const trigger = page.getByRole("button", { name: "Toggle" });

			await userEvent.hover(trigger);

			await rest(PATIENT_CLICK_THRESHOLD);

			await userEvent.click(trigger);

			expect(trigger.element()).not.toHaveAttribute("data-popup-open");

			// Leaving the trigger afterwards doesn't reopen it.
			await away();

			expect(trigger.element()).not.toHaveAttribute("data-popup-open");
		});

		it("sticks if the user clicks impatiently", async () => {
			await render(PopoverDemo, { triggerProps: { delay: 0, openOnHover: true } });

			const trigger = page.getByRole("button", { name: "Toggle" }).element();

			// Fake time: the click lands a millisecond before the window ends.
			fakeHover(trigger);

			// The hover opened the popover, so the click below lands on an open popover.
			expect(trigger).toHaveAttribute("data-popup-open");

			await rest(PATIENT_CLICK_THRESHOLD - 1);

			dispatch(trigger, "click");

			expect(trigger).toHaveAttribute("data-popup-open");

			fakeLeave(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");

			await rest(1);

			expect(trigger).toHaveAttribute("data-popup-open");
		});

		it("sticks when clicked before the hover delay completes", async () => {
			await render(PopoverDemo, {
				triggerProps: { openOnHover: true, delay: 300 },
				triggers: ["Open"],
				content: "Content",
			});

			const trigger = page.getByRole("button", { name: "Open" }).element();

			// Fake time: the click lands 100 ms into the 300 ms delay.
			fakeHover(trigger);

			await rest(100);

			// The user clicks impatiently to open.
			dispatch(trigger, "click");

			expect(trigger).toHaveAttribute("data-popup-open");

			fakeLeave(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");
		});

		it("keeps the popover open when re-hovered and clicked within the patient threshold", async () => {
			await render(PopoverDemo, {
				triggerProps: { openOnHover: true, delay: 100 },
				triggers: ["Open"],
				content: "Content",
			});

			const trigger = page.getByRole("button", { name: "Open" });

			await userEvent.hover(trigger);

			await rest(100);

			expect(page.getByText("Content").element()).not.toBe(null);

			await rest(PATIENT_CLICK_THRESHOLD);

			await away();
			await userEvent.hover(trigger);

			await userEvent.click(trigger);
			expect(page.getByText("Content").element()).not.toBe(null);
		});
	});

	describe("on two triggers, clicked on one and hovered on the other", () => {
		const CLOSE_DELAY = 100;

		async function setup() {
			const onOpenChange = vi.fn();
			await render(PopoverHoverTriggers, {
				triggerProps: { delay: 0, closeDelay: CLOSE_DELAY },
				onOpenChange,
			});
			const a = page.getByRole("button", { name: "A" });
			const b = page.getByRole("button", { name: "B" });
			return { a, b, onOpenChange };
		}

		/** Clicks `a` open and takes the pointer away; the click holds the popover open. */
		async function clickOpenAndLeave(a: Locator) {
			await userEvent.hover(a);
			await userEvent.click(a);
			await settle();
			await away();
			await rest(CLOSE_DELAY);
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for A");
		}

		it("closes when the pointer leaves the trigger a hover moved the popover to", async () => {
			const { a, b, onOpenChange } = await setup();
			await clickOpenAndLeave(a);

			await userEvent.hover(b);
			await settle();
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for B");
			expect(b.element()).toHaveAttribute("aria-expanded", "true");

			onOpenChange.mockClear();
			await away();
			await rest(CLOSE_DELAY);

			expect(popup()).toBe(null);
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
			expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
		});

		it("closes on leave after the hover brought the popover back to the clicked trigger", async () => {
			const { a, b } = await setup();
			await clickOpenAndLeave(a);

			await userEvent.hover(b);
			await settle();
			await userEvent.hover(a);
			await settle();
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for A");

			await away();
			await rest(CLOSE_DELAY);
			expect(popup()).toBe(null);
		});

		it("holds the popover open again after a click on the trigger the hover moved it to", async () => {
			const { a, b } = await setup();
			await clickOpenAndLeave(a);

			await userEvent.hover(b);
			await settle();
			await userEvent.click(b);
			await settle();
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for B");

			await away();
			await rest(CLOSE_DELAY);
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for B");
		});

		it("still holds a clicked popover open when the pointer hovers the same trigger and leaves", async () => {
			const { a } = await setup();
			await clickOpenAndLeave(a);

			// A hover on the trigger the popover belongs to is no new opening.
			await userEvent.hover(a);
			await rest(CLOSE_DELAY);
			await away();
			await rest(CLOSE_DELAY);

			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for A");
		});

		it("closes on leave when a hover on one trigger was moved to the other by hover", async () => {
			const { a, b } = await setup();

			await userEvent.hover(a);
			await settle();
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for A");
			await userEvent.hover(b);
			await settle();
			expect(page.getByTestId("popup").element()).toHaveTextContent("Details for B");

			await away();
			await rest(CLOSE_DELAY);
			expect(popup()).toBe(null);
		});
	});
});

describe("Popover with detached hover triggers", () => {
	useFakeTime();

	it("opens and closes on a hover, again and again", async () => {
		const handle = Popover.createHandle();
		await render(PopoverDemo, {
			variant: "detached",
			handle,
			triggers: ["Trigger 1", "Trigger 2", "Trigger 3"],
			triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
		});
		const trigger = page.getByRole("button", { name: "Trigger 1" });

		async function openAndClose() {
			await userEvent.hover(trigger);
			await settle();
			expect(page.getByRole("dialog").query()).not.toBe(null);
			expect(trigger.element()).toHaveAttribute("aria-expanded", "true");

			// Covers the patient-click window ending while open.
			await rest(PATIENT_CLICK_THRESHOLD);
			await away();
			handle.close();
			await settle();
			expect(page.getByRole("dialog").query()).toBe(null);
			expect(trigger.element()).toHaveAttribute("aria-expanded", "false");
		}

		await openAndClose();
		await openAndClose();
	});

	it("lets a press take over a hover-opened popup", async () => {
		const handle = Popover.createHandle();
		await render(PopoverDemo, {
			variant: "detached",
			handle,
			triggers: ["Trigger 1", "Trigger 2", "Trigger 3"],
			triggerProps: { openOnHover: true, delay: 0, closeDelay: 0 },
		});
		const trigger = page.getByRole("button", { name: "Trigger 1" });

		await userEvent.hover(trigger);
		await settle();
		expect(page.getByRole("dialog").query()).not.toBe(null);

		// A press inside the patient-click window keeps it open and changes the open reason.
		await userEvent.click(trigger);
		await settle();
		expect(trigger.element()).toHaveAttribute("data-pressed");

		await away();
		handle.close();
		await settle();
		expect(page.getByRole("dialog").query()).toBe(null);
	});

	describe("after the app closes and reopens the popup", () => {
		async function setup() {
			const handle = Popover.createHandle();
			const screen = await render(PopoverAppOpen, { detached: true, handle });
			const setOpen = async (open: boolean) => {
				screen.component.setOpen(open);
				await settle();
			};
			return { setOpen, trigger: page.getByRole("button", { name: "Trigger 1" }) };
		}

		it("keeps the popup open when the last hovered trigger is pressed", async () => {
			const { setOpen, trigger } = await setup();

			await userEvent.hover(trigger);
			await settle();
			expect(popup()).not.toBe(null);
			// End the hover's patient-click window so only the close-time reset keeps the click sticky.
			await rest(PATIENT_CLICK_THRESHOLD);

			await setOpen(false);
			expect(popup()).toBe(null);

			await setOpen(true);
			expect(popup()).not.toBe(null);

			await userEvent.click(trigger);
			await settle();
			expect(popup()).not.toBe(null);
		});

		it("keeps a hover-opened popup open on a press, and hover opens it after the next close", async () => {
			const { setOpen, trigger } = await setup();

			await userEvent.hover(trigger);
			await settle();
			expect(popup()).not.toBe(null);
			// The patient-click window ends while open.
			await rest(PATIENT_CLICK_THRESHOLD);

			await setOpen(false);
			expect(popup()).toBe(null);
			await setOpen(true);
			expect(popup()).not.toBe(null);

			// The hover that opened it is still on record, so the press keeps it open.
			await userEvent.click(trigger);
			await settle();
			expect(popup()).not.toBe(null);

			await away();
			await setOpen(false);
			expect(popup()).toBe(null);

			await userEvent.hover(trigger);
			await settle();
			expect(popup()).not.toBe(null);
		});
	});

	it("doesn't open a popover from a trigger's pending hover once its handle moved on and it unmounted", async () => {
		const onOpenChange = vi.fn();
		const screen = await render(PopoverHandleMove, {
			onOpenChange,
			triggerProps: { openOnHover: true, delay: 100 },
		});

		// Fake time: the trigger moves to the other handle 50 ms into the 100 ms delay, then goes.
		fakeHover(page.getByRole("button", { name: "Trigger" }).element());
		await rest(50);
		await screen.rerender({ which: 2 });
		await screen.rerender({ showTrigger: false });
		await rest(200);

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});
