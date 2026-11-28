// The trees are fixtures (a `<span>` trigger is a render snippet); `flushMicrotasks` is an empty
// `act`. The real-browser case renders with the shim and drives the browser with `userEvent` from
// `vitest/browser`. The conformance root names the trigger with `triggerId` so its server render
// shows the open state (see popover-trigger-conformance.ts). The Shift+Tab focus
// case waits for initial focus to reach the popup (`waitForPopupFocus`) before each Shift+Tab:
// the keypress otherwise races the frame-delayed focus (WebKit). The SSR
// cases at the end hydrate the HTML popover.ssr.test.ts writes.

import { PATIENT_CLICK_THRESHOLD } from "@sohedra/primitives-core/components/popover/index.js";
import { flushSync } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent as browserUser } from "vitest/browser";

import { Popover } from "#lib/components/popover/index.js";

import { describeConformance } from "../../conformance/describe-conformance.js";
import { ssrHydration } from "../../conformance/ssr-hydration.js";
import { act, createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import PartMultiTriggerPopover from "./fixtures/popover-multi-trigger.svelte";
import PartSsrPopover from "./fixtures/popover-ssr.svelte";
import { popoverTriggerConformance } from "./fixtures/popover-trigger-conformance.js";
import PartTriggerPopover from "./fixtures/popover-trigger.svelte";

const serverHtml = import.meta.glob<string>("./__ssr__/*.html", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** An empty `act`, to flush microtasks. */
const flushMicrotasks = () => act(async () => {});

/** Moves the mouse onto an element: pointerenter, mouseenter and mousemove. */
function enterWithMouse(element: HTMLElement, init?: MouseEventInit) {
	fireEvent.pointerEnter(element, { pointerType: "mouse", ...init });
	fireEvent.mouseEnter(element, init);
	fireEvent.mouseMove(element, init);
}

/** Moves the real browser pointer off every element. */
async function resetBrowserPointer() {
	await browserUser.unhover(document.body);
}

describe("<Popover.Trigger />", () => {
	beforeEach(resetBrowserPointer);

	const { render } = createRenderer();

	describeConformance("Popover.Trigger", () => popoverTriggerConformance);

	it("throws a descriptive error when rendered without a root or a handle", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(render(Popover.Trigger as never)).rejects.toThrow(
				"Sohedra: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.",
			);
		} finally {
			errorSpy.mockRestore();
		}
	});

	describe("prop: disabled", () => {
		it("disables the popover", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { disabled: true },
				content: "Content",
			});

			const trigger = screen.getByRole("button");
			expect(trigger).toHaveAttribute("disabled");
			expect(trigger).toHaveAttribute("data-disabled");

			await user.click(trigger);
			expect(screen.queryByText("Content")).toBe(null);

			await user.keyboard("[Tab]");
			expect(document.activeElement).not.toBe(trigger);
		});

		it("custom element", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { disabled: true, nativeButton: false },
				renderAs: "span",
				content: "Content",
			});

			const trigger = screen.getByRole("button");
			expect(trigger).not.toHaveAttribute("disabled");
			expect(trigger).toHaveAttribute("data-disabled");
			expect(trigger).toHaveAttribute("aria-disabled", "true");

			await user.click(trigger);
			expect(screen.queryByText("Content")).toBe(null);

			await user.keyboard("[Tab]");
			expect(document.activeElement).not.toBe(trigger);
		});

		it("does not open on hover when disabled", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { disabled: true, openOnHover: true, delay: 0, nativeButton: false },
				renderAs: "span",
				content: "Content",
			});

			const trigger = screen.getByRole("button");
			expect(trigger).toHaveAttribute("data-disabled");

			await user.hover(trigger);
			await flushMicrotasks();

			expect(screen.queryByText("Content")).toBe(null);
			expect(trigger).not.toHaveAttribute("data-popup-open");
		});
	});

	describe("openOnHover opened by touch", () => {
		async function pressTrigger(trigger: HTMLElement, pointerType: "mouse" | "touch") {
			await act(async () => {
				fireEvent.pointerDown(trigger, { pointerType });
				fireEvent.mouseDown(trigger);
				fireEvent.click(trigger, { detail: 1 });
			});
		}

		function hoverTrigger(trigger: HTMLElement) {
			enterWithMouse(trigger);
		}

		// A touch tap leaves the pointer parked wherever the cursor happens to be, so hover must stay
		// disarmed until the popover is reopened by some other means. Otherwise a stray hover over a
		// sibling trigger silently swaps the content the user just tapped for.
		it("keeps ownership on the tapped trigger when a sibling trigger is hovered", async () => {
			await render(PartMultiTriggerPopover);

			const one = screen.getByRole("button", { name: "One" });
			const two = screen.getByRole("button", { name: "Two" });

			await pressTrigger(one, "touch");

			expect(screen.getByTestId("content")).toHaveTextContent("One");

			hoverTrigger(two);
			await flushMicrotasks();

			expect(screen.getByTestId("content")).toHaveTextContent("One");
			expect(two).toHaveAttribute("aria-expanded", "false");
		});

		// The same hover must still take over when the popover was opened with a mouse, so the guard
		// above can't be a blanket disable.
		it("hands ownership to a hovered sibling trigger when opened by mouse", async () => {
			await render(PartMultiTriggerPopover);

			const one = screen.getByRole("button", { name: "One" });
			const two = screen.getByRole("button", { name: "Two" });

			await pressTrigger(one, "mouse");

			expect(screen.getByTestId("content")).toHaveTextContent("One");

			hoverTrigger(two);
			await flushMicrotasks();

			expect(screen.getByTestId("content")).toHaveTextContent("Two");
			expect(two).toHaveAttribute("aria-expanded", "true");
		});
	});

	describe("style hooks", () => {
		it("should have the data-popup-open and data-pressed attributes when open by clicking", async () => {
			await render(PartTriggerPopover, { withPopup: false });

			const trigger = screen.getByRole("button");

			await act(async () => {
				trigger.click();
			});

			expect(trigger).toHaveAttribute("data-popup-open");
			expect(trigger).toHaveAttribute("data-pressed");
		});

		it("should have the data-popup-open but not the data-pressed attribute when open by hover", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { openOnHover: true, delay: 0 },
			});

			const trigger = screen.getByRole("button");

			await user.hover(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");
			expect(trigger).not.toHaveAttribute("data-pressed");
		});

		it("should not have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true` and `delay=0`", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { delay: 0, openOnHover: true },
			});

			const trigger = screen.getByRole("button");

			await user.hover(trigger);

			await act(async () => {
				trigger.click();
			});

			expect(trigger).toHaveAttribute("data-popup-open");
		});

		it("should have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true`", async () => {
			const { user } = await render(PartTriggerPopover, {
				triggerProps: { openOnHover: true },
			});

			const trigger = screen.getByRole("button");

			await user.hover(trigger);
			await act(async () => {
				trigger.click();
			});

			expect(trigger).toHaveAttribute("data-popup-open");
			expect(trigger).toHaveAttribute("data-pressed");
		});
	});

	describe("impatient clicks with `openOnHover=true`", () => {
		const { clock, render: renderFakeTimers } = createRenderer();

		clock.withFakeTimers();

		it("closes the popover if the user clicks patiently", async () => {
			await renderFakeTimers(PartTriggerPopover, {
				triggerProps: { delay: 0, openOnHover: true },
			});

			const trigger = screen.getByRole("button");

			fireEvent.mouseEnter(trigger);

			clock.tick(PATIENT_CLICK_THRESHOLD);

			fireEvent.click(trigger);

			expect(trigger).not.toHaveAttribute("data-popup-open");

			// Leaving the trigger afterwards doesn't reopen it.
			fireEvent.mouseLeave(trigger);

			expect(trigger).not.toHaveAttribute("data-popup-open");
		});

		it("sticks if the user clicks impatiently", async () => {
			await renderFakeTimers(PartTriggerPopover, {
				triggerProps: { delay: 0, openOnHover: true },
			});

			const trigger = screen.getByRole("button");

			fireEvent.mouseEnter(trigger);

			// The hover opened the popover, so the click below lands on an open popover.
			expect(trigger).toHaveAttribute("data-popup-open");

			clock.tick(PATIENT_CLICK_THRESHOLD - 1);

			fireEvent.click(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");

			fireEvent.mouseLeave(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");

			clock.tick(1);

			expect(trigger).toHaveAttribute("data-popup-open");
		});

		it("sticks when clicked before the hover delay completes", async () => {
			await renderFakeTimers(PartTriggerPopover, {
				triggerProps: { openOnHover: true, delay: 300 },
				triggerText: "Open",
				content: "Content",
			});

			const trigger = screen.getByRole("button");

			fireEvent.mouseEnter(trigger);
			fireEvent.mouseMove(trigger);

			clock.tick(100);

			// User clicks impatiently to open
			fireEvent.click(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");

			fireEvent.mouseLeave(trigger);

			expect(trigger).toHaveAttribute("data-popup-open");
		});

		it("should keep the popover open when re-hovered and clicked within the patient threshold", async () => {
			await render(PartTriggerPopover, {
				triggerProps: { openOnHover: true, delay: 100 },
				triggerText: "Open",
				content: "Content",
			});

			const trigger = screen.getByRole("button");

			fireEvent.mouseEnter(trigger);
			fireEvent.mouseMove(trigger);

			clock.tick(100);
			await flushMicrotasks();

			expect(screen.getByText("Content")).not.toBe(null);

			clock.tick(PATIENT_CLICK_THRESHOLD);

			fireEvent.mouseLeave(trigger);
			fireEvent.mouseEnter(trigger);
			fireEvent.mouseMove(trigger);

			fireEvent.click(trigger);
			expect(screen.getByText("Content")).not.toBe(null);
		});
	});

	it("should toggle closed with Enter or Space when rendering a <div>", async () => {
		await render(PartTriggerPopover, {
			triggerProps: { nativeButton: false, "data-testid": "div-trigger" } as never,
			renderAs: "div",
			triggerText: "Toggle",
			content: "Content",
			otherButton: true,
		});

		const trigger = screen.getByTestId("div-trigger");

		// Initial focus moves into the popup a frame after opening (enqueueFocus): wait for it before
		// Shift+Tab, or the keypress races it (WebKit).
		const waitForPopupFocus = () =>
			waitFor(() => {
				expect(document.activeElement).toBe(screen.getByText("Content"));
			});

		await act(async () => trigger.focus());
		await browserUser.keyboard("[Enter]");
		expect(screen.queryByText("Content")).not.toBe(null);

		await waitForPopupFocus();
		await browserUser.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await browserUser.keyboard("[Enter]");
		await waitFor(() => {
			expect(screen.queryByText("Content")).toBe(null);
		});

		await browserUser.keyboard("[Enter]");
		expect(screen.queryByText("Content")).not.toBe(null);

		await waitForPopupFocus();
		await browserUser.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await browserUser.keyboard("[Space]");
		expect(screen.queryByText("Content")).toBe(null);

		await browserUser.keyboard("[Space]");
		expect(screen.queryByText("Content")).not.toBe(null);

		await waitForPopupFocus();
		await browserUser.tab({ shift: true });
		expect(document.activeElement).toBe(trigger);

		await browserUser.keyboard("[Space]");
		expect(screen.queryByText("Content")).toBe(null);
	});

	// Sohedra: the server renders a popover's trigger only (its Portal renders after mount), and
	// hydration picks the popover up from there.
	describe("server rendering", () => {
		function getHtml(file: string) {
			const html = serverHtml[`./__ssr__/${file}`];
			if (html === undefined) {
				throw new Error(
					`tests/components/popover/__ssr__/${file} is missing. Run popover.ssr.test.ts in the ssr project to write it.`,
				);
			}
			return html;
		}

		it("hydrates a closed popover's trigger without warnings and opens it", () => {
			let trigger: HTMLElement | null = null;
			const { before, after } = ssrHydration(
				PartSsrPopover,
				{ defaultOpen: false },
				getHtml("popover-closed.html"),
				(container) => {
					trigger = container.querySelector("[data-testid=trigger]");
					expect(trigger).toHaveAttribute("aria-expanded", "false");
					expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
					expect(trigger).not.toHaveAttribute("aria-controls");
					expect(document.querySelector("[data-sohedra-portal]")).toBe(null);
					trigger!.click();
					flushSync();
					expect(trigger).toHaveAttribute("aria-expanded", "true");
					expect(screen.getByRole("dialog")).toBeInTheDocument();
					expect(trigger).toHaveAttribute("aria-controls", screen.getByRole("dialog").id);
				},
			);
			expect(before.map(({ tag }) => tag)).toEqual(["button"]);
			expect(after).toEqual(before);
		});

		it("hydrates a defaultOpen popover without warnings, then shows the popup", () => {
			let dialog: HTMLElement | null = null;
			const { before } = ssrHydration(
				PartSsrPopover,
				{ defaultOpen: true },
				getHtml("popover-default-open.html"),
				(container) => {
					const trigger = container.querySelector("[data-testid=trigger]");
					dialog = screen.getByRole("dialog");
					expect(dialog.closest("[data-sohedra-portal]")?.parentElement).toBe(document.body);
					expect(dialog).toHaveAttribute("data-open");
					expect(dialog).toHaveAttribute("aria-labelledby", screen.getByText("Title").id);
					expect(dialog).toHaveAttribute("aria-describedby", screen.getByText("Description").id);
					expect(trigger).toHaveAttribute("aria-expanded", "true");
					expect(trigger).toHaveAttribute("aria-controls", dialog.id);
				},
			);
			expect(before.map(({ tag }) => tag)).toEqual(["button"]);
			expect(before[0]!.data).not.toHaveProperty("data-popup-open");
			expect(dialog).not.toBe(null);
		});
	});
});
