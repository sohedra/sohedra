// New cases: one popover with two hover-opening triggers, clicked open on one and then hovered
// on the other. A click holds a popover open when the pointer leaves; a hover that moves the
// popover to another trigger is a new opening by hover, so the click on the first trigger no
// longer holds it. Fake timers; the pointer is driven with `fireEvent`.

import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import HoverTriggerHandoff from "./fixtures/popover-hover-trigger-handoff.svelte";

const CLOSE_DELAY = 100;

/** Flushes pending microtasks. */
async function flushMicrotasks() {
	await act(async () => {});
}

/** The pointer comes onto the trigger and moves there. */
function hover(trigger: HTMLElement) {
	fireEvent.mouseEnter(trigger);
	fireEvent.mouseMove(trigger, { movementX: 10, movementY: 10 });
}

/** The pointer leaves the trigger away from the popup and the other trigger. */
function leave(trigger: HTMLElement) {
	fireEvent.mouseLeave(trigger, { clientX: -100, clientY: -100, relatedTarget: document.body });
}

describe("<Popover.Root /> with two hover triggers, clicked on one and hovered on the other", () => {
	beforeEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
	});

	const { render, clock } = createRenderer();

	clock.withFakeTimers();

	async function rest(ms = CLOSE_DELAY) {
		clock.tick(ms);
		await flushMicrotasks();
	}

	async function setup() {
		const onOpenChange = vi.fn();
		await render(HoverTriggerHandoff, {
			triggerProps: { delay: 0, closeDelay: CLOSE_DELAY },
			onOpenChange,
		});
		const a = screen.getByRole("button", { name: "A" });
		const b = screen.getByRole("button", { name: "B" });
		return { a, b, onOpenChange };
	}

	/** Clicks `a` open and takes the pointer away; the click holds the popover open. */
	async function clickOpenAndLeave(a: HTMLElement) {
		hover(a);
		fireEvent.click(a);
		await flushMicrotasks();
		leave(a);
		await rest();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for A");
	}

	it("closes when the pointer leaves the trigger a hover moved the popover to", async () => {
		const { a, b, onOpenChange } = await setup();
		await clickOpenAndLeave(a);

		hover(b);
		await flushMicrotasks();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for B");
		expect(b).toHaveAttribute("aria-expanded", "true");

		onOpenChange.mockClear();
		leave(b);
		await rest();

		expect(screen.queryByTestId("popup")).toBe(null);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerHover);
	});

	it("closes on leave after the hover brought the popover back to the clicked trigger", async () => {
		const { a, b } = await setup();
		await clickOpenAndLeave(a);

		hover(b);
		await flushMicrotasks();
		leave(b);
		hover(a);
		await flushMicrotasks();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for A");

		leave(a);
		await rest();
		expect(screen.queryByTestId("popup")).toBe(null);
	});

	it("holds the popover open again after a click on the trigger the hover moved it to", async () => {
		const { a, b } = await setup();
		await clickOpenAndLeave(a);

		hover(b);
		await flushMicrotasks();
		fireEvent.click(b);
		await flushMicrotasks();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for B");

		leave(b);
		await rest();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for B");
	});

	it("still holds a clicked popover open when the pointer hovers the same trigger and leaves", async () => {
		const { a } = await setup();
		await clickOpenAndLeave(a);

		// A hover on the trigger the popover belongs to is no new opening.
		hover(a);
		await rest();
		leave(a);
		await rest();

		expect(screen.getByTestId("popup")).toHaveTextContent("Details for A");
	});

	it("closes on leave when a hover on one trigger was moved to the other by hover", async () => {
		const { a, b } = await setup();

		hover(a);
		await flushMicrotasks();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for A");
		leave(a);
		hover(b);
		await flushMicrotasks();
		expect(screen.getByTestId("popup")).toHaveTextContent("Details for B");

		leave(b);
		await rest();
		expect(screen.queryByTestId("popup")).toBe(null);
	});
});
