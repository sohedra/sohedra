// New cases: a hover-opening popover the app closes itself, by setting the bound `open` to false
// (the "Done" button of the fixture, or `setOpen` from the test) instead of through one of the
// popover's own close paths. Such a close reports nothing, so the trigger's hover used to keep
// judging by the opening before it. Fake timers; the pointer is driven with `fireEvent`.

import { PATIENT_CLICK_THRESHOLD } from "@sohedra/primitives-core/components/popover/index.js";
import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Popover } from "#lib/components/popover/index.js";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import DetachedPropReopen from "./fixtures/popover-detached-prop-reopen.svelte";
import HoverAppClose from "./fixtures/popover-hover-app-close.svelte";

const DELAY = 100;

/** Flushes pending microtasks. */
async function flushMicrotasks() {
	await act(async () => {});
}

/** The pointer comes onto the trigger and moves there. */
function hover(trigger: HTMLElement) {
	fireEvent.mouseEnter(trigger);
	fireEvent.mouseMove(trigger, { movementX: 10, movementY: 10 });
}

/** The pointer leaves the trigger away from the popup. */
function leave(trigger: HTMLElement) {
	fireEvent.mouseLeave(trigger, { clientX: -100, clientY: -100, relatedTarget: document.body });
}

describe("<Popover.Root /> closed by the app, with openOnHover", () => {
	beforeEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
	});

	const { render, clock } = createRenderer();

	clock.withFakeTimers();

	async function rest(ms = DELAY) {
		clock.tick(ms);
		await flushMicrotasks();
	}

	async function setup(props: { keepMounted?: boolean; closeDelay?: number } = {}) {
		const onOpenChange = vi.fn();
		const { component } = await render(HoverAppClose, {
			triggerProps: { delay: DELAY, closeDelay: props.closeDelay ?? 0 },
			keepMounted: props.keepMounted ?? false,
			onOpenChange,
		});
		const trigger = screen.getByRole("button", { name: "Trigger" });
		const setOpen = async (open: boolean) => {
			await act(async () => component.setOpen(open));
			await flushMicrotasks();
		};
		return { trigger, setOpen, onOpenChange };
	}

	it("opens on hover again after a click-opened popover was closed by the app", async () => {
		const { trigger } = await setup();

		fireEvent.click(trigger);
		await flushMicrotasks();
		expect(screen.queryByTestId("popup")).not.toBe(null);

		// Held open by the click: the pointer leaves for the popup and it stays.
		leave(trigger);
		await rest();
		expect(screen.queryByTestId("popup")).not.toBe(null);

		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		await flushMicrotasks();
		expect(screen.queryByTestId("popup")).toBe(null);
		expect(trigger).toHaveAttribute("aria-expanded", "false");

		hover(trigger);
		await rest();
		expect(screen.queryByTestId("popup")).not.toBe(null);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
	});

	it("opens on hover again after a click pinned a hover-opened popover and the app closed it", async () => {
		const { trigger, onOpenChange } = await setup();

		hover(trigger);
		await rest();
		expect(screen.queryByTestId("popup")).not.toBe(null);

		// An impatient click keeps it open and pins it.
		fireEvent.click(trigger);
		await flushMicrotasks();
		leave(trigger);
		await rest();
		expect(screen.queryByTestId("popup")).not.toBe(null);

		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		await flushMicrotasks();
		expect(screen.queryByTestId("popup")).toBe(null);

		onOpenChange.mockClear();
		hover(trigger);
		await rest();
		expect(screen.queryByTestId("popup")).not.toBe(null);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
	});

	it("opens on hover after each close by the app, not only the first", async () => {
		const { trigger, setOpen } = await setup();

		fireEvent.click(trigger);
		await flushMicrotasks();
		await setOpen(false);

		for (let round = 0; round < 2; round += 1) {
			hover(trigger);
			await rest();
			expect(screen.queryByTestId("popup")).not.toBe(null);
			leave(trigger);
			await setOpen(false);
			expect(screen.queryByTestId("popup")).toBe(null);
		}
	});

	it("doesn't reopen a kept-mounted popover when the app closes it while a hover open is pending", async () => {
		const { trigger, setOpen, onOpenChange } = await setup({ keepMounted: true });

		// The pointer rests on the trigger; before the rest ends the app opens and closes the popover.
		hover(trigger);
		await rest(DELAY - 60);
		await setOpen(true);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		await setOpen(false);
		expect(trigger).toHaveAttribute("aria-expanded", "false");

		await rest(DELAY * 3);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("reports no late hover close after the app closed a kept-mounted popover", async () => {
		const { trigger, setOpen, onOpenChange } = await setup({ keepMounted: true, closeDelay: 100 });

		hover(trigger);
		await rest();
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// The pointer leaves: the close waits for its delay. The app closes the popover meanwhile.
		leave(trigger);
		await rest(40);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		await setOpen(false);
		expect(trigger).toHaveAttribute("aria-expanded", "false");

		await rest(300);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
	});

	it("reports no hover close when the pointer leaves a kept-mounted popover the app closed under it", async () => {
		const { trigger, onOpenChange } = await setup({ keepMounted: true });

		hover(trigger);
		await rest();
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// The pointer travels into the popup and presses the button that closes it.
		const positioner = screen.getByTestId("positioner");
		fireEvent.mouseLeave(trigger, { relatedTarget: positioner });
		fireEvent.mouseEnter(positioner);
		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		await flushMicrotasks();
		expect(trigger).toHaveAttribute("aria-expanded", "false");

		// The closed popup no longer takes the pointer, so the browser reports it leaving.
		fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
		await rest(300);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
	});

	it("keeps a click-opened popover pinned after the app closed and reopened it", async () => {
		const { trigger, setOpen } = await setup({ keepMounted: true });

		fireEvent.click(trigger);
		await flushMicrotasks();
		await setOpen(false);
		await setOpen(true);
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		// Open again and still held by its click: hovering in and out doesn't close it.
		hover(trigger);
		leave(trigger);
		await rest(300);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
	});

	it("stays closed while the pointer rests on the trigger after the app closed a hover-opened popover", async () => {
		const { trigger, setOpen, onOpenChange } = await setup();

		hover(trigger);
		await rest();
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		await setOpen(false);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		onOpenChange.mockClear();

		// The pointer never left: moves over the trigger, without a new enter, don't reopen it.
		fireEvent.mouseMove(trigger, { movementX: 10, movementY: 10 });
		await rest();
		fireEvent.mouseMove(trigger, { movementX: 20, movementY: 20 });
		await rest();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(onOpenChange).not.toHaveBeenCalled();

		// Leaving and coming back opens it.
		leave(trigger);
		hover(trigger);
		await rest();
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
	});

	describe("with several triggers", () => {
		it("keeps a hover-opened popup open on a press after a reopen by the app, and hover opens it after the next close", async () => {
			const handle = Popover.createHandle();
			const { component } = await render(DetachedPropReopen, { handle });
			const setOpen = async (open: boolean) => {
				await act(async () => component.setOpen(open));
				await flushMicrotasks();
			};
			const trigger = screen.getByRole("button", { name: "Trigger 1" });

			hover(trigger);
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);
			// The patient-click window ends while open.
			clock.tick(PATIENT_CLICK_THRESHOLD);

			await setOpen(false);
			expect(screen.queryByTestId("popup")).toBe(null);
			await setOpen(true);
			expect(screen.queryByTestId("popup")).not.toBe(null);

			// The hover that opened it is still on record, so the press keeps it open.
			fireEvent.click(trigger);
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);

			leave(trigger);
			await setOpen(false);
			expect(screen.queryByTestId("popup")).toBe(null);

			hover(trigger);
			await flushMicrotasks();
			expect(screen.queryByTestId("popup")).not.toBe(null);
		});
	});
});
