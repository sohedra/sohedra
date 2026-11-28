import { REASONS } from "@sohedra/primitives-core/foundation/kernel";
// The dismissal's wiring, through an initially open Popover (fixtures/dismiss-popover.svelte):
// which outside presses close it, with its mouse outside press `intentional` (it dismisses on
// `click`), what a press stopped on its way does, and when Escape belongs to a text composition
// instead of the popup.
// - The outside presses land on the page itself (`document.body`), where the dismissal's document
//   listeners see them, and each case composes the exact events it is about (a drag's
//   compatibility events, a click count, a button), so they are synthetic (kit dispatch).
// - The reopening anchor is the Popover trigger, the `pointerdown`-opening button is `opener`,
//   the prevented `scrubber` is `scrubber`, and the store the cases call `setOpen` on is the
//   Root's (`onStore`), whose details carry a `fallbackEvent()`.
// - "press survives listener re-attachment while open": a Popover has no dismissal option that
//   can change while open, so the fixture re-creates the Positioner (the popup, which
//   the document listeners depend on) instead.
import type { PopoverStore } from "@sohedra/primitives-core/popover";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { server, userEvent } from "vitest/browser";

import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";
import {
	createChangeEventDetails,
	fallbackEvent,
	type WebTypes,
} from "#lib/foundation/kernel/index.js";

import { dispatch } from "../../kit/kit-events.js";
import { nextTask, settle } from "../../kit/kit-frames.js";
import DismissPopover from "./fixtures/dismiss-popover.svelte";

type OpenChange = [open: boolean, details: PopoverRootChangeEventDetails];

const isWebKit = server.browser === "webkit";

/** The page outside the popup. */
const outside = document.body;

async function setup(props: Parameters<typeof render<typeof DismissPopover>>[1] = {}) {
	const screen = await render(DismissPopover, props);
	return { screen, popup: screen.getByTestId("popup") };
}

/** A primary mouse press on `target`: its pointerdown, then its mousedown. */
function mousePress(target: EventTarget) {
	dispatch(target, "pointerdown", { pointerType: "mouse" });
	dispatch(target, "mousedown");
}

/** The store `setOpen` call a Popover part makes, with no event behind it. */
function setOpen(store: PopoverStore<unknown, WebTypes>, open: boolean) {
	store.setOpen(open, createChangeEventDetails(REASONS.none, fallbackEvent()) as never);
}

describe("dismiss", () => {
	describe("outsidePressEvent: intentional", () => {
		it("dragging outside the popup does not close", async () => {
			const { popup } = await setup();
			// A drag from the popup that ends outside it, with no click.
			dispatch(popup, "mousedown");
			dispatch(outside, "mouseup");
			await settle();
			await expect.element(popup).toBeInTheDocument();
		});

		it("dragging inside the popup does not close", async () => {
			const { popup } = await setup();
			// A drag that starts outside and ends in the popup.
			dispatch(outside, "mousedown");
			dispatch(popup, "mouseup");
			// The browser fires the gesture's click on the common ancestor of the
			// mousedown and mouseup targets; the mouseup inside the popup
			// marks the component tree so this click must not dismiss.
			dispatch(outside, "click", { detail: 1 });
			await settle();
			await expect.element(popup).toBeInTheDocument();
		});

		it("dragging outside the popup then clicking outside closes", async () => {
			const { popup } = await setup();
			// A drag out of the popup, then two clicks with no press, as a script sends them.
			dispatch(popup, "mousedown");
			dispatch(outside, "mouseup");
			// A click event will have fired before the proper outside click.
			dispatch(outside, "click");
			dispatch(outside, "click");
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("dragging outside the popup then clicking outside closes with mouse clicks", async () => {
			const { popup } = await setup();
			// A drag out of the popup, then mouse clicks on the page, event by event.
			dispatch(popup, "pointerdown", { pointerType: "mouse" });
			dispatch(popup, "mousedown");
			dispatch(outside, "mouseup");

			// Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
			// and is consumed by the one-shot drag suppression.
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).toBeInTheDocument();

			// The next press-backed mouse click closes.
			mousePress(outside);
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("compatibility events of the pointerdown that opened the popup do not count as a new press", async () => {
			const { screen, popup } = await setup({ open: false, openOnPointerDown: true });
			const opener = screen.getByTestId("opener");

			// A press whose pointerdown opens the popup and whose release lands on the page.
			dispatch(opener, "pointerdown", { pointerType: "mouse" });
			await expect.element(popup).toBeInTheDocument();

			// The pointerdown happened before the popup opened. Its
			// compatibility events arrive after opening but belong to the same press.
			dispatch(opener, "mousedown");
			dispatch(outside, "mouseup");
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).toBeInTheDocument();

			// A new pointer press that begins while open still dismisses.
			mousePress(outside);
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press-less outside click reporting a pointer type closes", async () => {
			const { popup } = await setup();

			// Android assistive technology reports `pointerType: 'mouse'` with no press behind
			// it, so the click count is what separates the two.
			const click = new MouseEvent("click", { bubbles: true, detail: 0 });
			Object.defineProperty(click, "pointerType", { value: "mouse" });
			dispatch(outside, click);
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press seen in a previous open session does not leak into a reopen", async () => {
			const { screen, popup } = await setup();

			// A genuine outside press closes and leaves a press on record.
			mousePress(outside);
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();

			await userEvent.click(screen.getByTestId("anchor"));
			await expect.element(popup).toBeInTheDocument();

			// The reopened session must not inherit the previous session's press:
			// a press-less trailing click still must not count as an outside press.
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).toBeInTheDocument();

			// A press observed in the new session still closes.
			mousePress(outside);
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press seen before a same-batch close and reopen does not leak into the new session", async () => {
			let store!: PopoverStore<unknown, WebTypes>;
			const { popup } = await setup({
				onStore: (value) => {
					store = value;
				},
			});

			// A press lands while the first session is open.
			mousePress(outside);

			// Nothing renders `open === false` here, so only `openchange` can observe the
			// session boundary.
			setOpen(store, false);
			setOpen(store, true);
			await settle();
			await expect.element(popup).toBeInTheDocument();

			// The gesture's trailing click belongs to the previous session and must
			// not dismiss the reopened popup.
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).toBeInTheDocument();

			// A press observed in the new session still closes.
			mousePress(outside);
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press survives a redundant open dispatch while already open", async () => {
			let store!: PopoverStore<unknown, WebTypes>;
			const { popup } = await setup({
				onStore: (value) => {
					store = value;
				},
			});

			// A genuine outside press lands while open.
			mousePress(outside);

			// A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
			// does not end the session, so the press stays on record.
			setOpen(store, true);
			await settle();
			await expect.element(popup).toBeInTheDocument();

			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press survives listener re-attachment while open", async () => {
			const { screen, popup } = await setup();
			const positioner = popup.element().parentElement;

			// An outside press, then its click once the listeners have been re-attached.
			mousePress(outside);

			// Changing an effect dependency mid-gesture re-attaches the document listeners;
			// the observed press must survive that.
			await screen.rerender({ popupKey: 1 });
			expect(popup.element().parentElement).not.toBe(positioner);

			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("non-primary-button press does not count as an outside press", async () => {
			const { popup } = await setup();

			// A right-button press produces `contextmenu`, not `click`, so it must
			// not vouch for a later press-less click.
			dispatch(outside, "pointerdown", { pointerType: "mouse", button: 2 });
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).toBeInTheDocument();

			// A primary-button press still closes.
			dispatch(outside, "pointerdown", { pointerType: "mouse" });
			dispatch(outside, "click", { detail: 1 });
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("inside click then programmatic outside click closes", async () => {
			const { screen, popup } = await setup();

			await userEvent.click(screen.getByRole("textbox"));
			await expect.element(popup).toBeInTheDocument();

			// A script's click on the page: no press, no click count.
			dispatch(outside, "click");
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("inside click after drag does not cause immediate close on first outside click", async () => {
			const { screen, popup } = await setup();
			const insideInput = screen.getByRole("textbox");

			// A drag out of the popup, then clicks with no press behind them.
			dispatch(popup, "mousedown");
			dispatch(outside, "mouseup");

			// Inside clicks should never dismiss, and they should not consume the
			// one-shot outside click suppression from the drag that started inside.
			dispatch(insideInput, "click");
			await expect.element(popup).toBeInTheDocument();

			// First true outside click after that drag is still ignored once.
			dispatch(outside, "click");
			await expect.element(popup).toBeInTheDocument();

			// The next outside click is a deliberate outside press and dismisses.
			dispatch(outside, "click");
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("press start prevented inside suppresses only immediate outside click", async () => {
			const { screen, popup } = await setup({ scrubber: true });
			const scrubber = screen.getByTestId("scrubber");

			// A press on the scrubber, released on the page, then clicks with no press.
			dispatch(scrubber, "pointerdown", { pointerType: "mouse", button: 0 });
			dispatch(scrubber, "mousedown", { button: 0 });
			dispatch(outside, "pointerup", { pointerType: "mouse", button: 0 });
			dispatch(outside, "mouseup", { button: 0 });

			dispatch(outside, "click");
			await expect.element(popup).toBeInTheDocument();

			await nextTask();

			dispatch(outside, "click");
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("pointercancel after prevented press start suppresses immediate outside click", async () => {
			const { screen, popup } = await setup({ scrubber: true });
			const scrubber = screen.getByTestId("scrubber");

			// A press on the scrubber that the browser cancels, then clicks with no press.
			dispatch(scrubber, "pointerdown", { pointerType: "mouse", button: 0 });
			dispatch(scrubber, "mousedown", { button: 0 });
			dispatch(outside, "pointercancel", { pointerType: "mouse" });

			dispatch(outside, "click");
			await expect.element(popup).toBeInTheDocument();

			await nextTask();

			dispatch(outside, "click");
			await expect.element(popup).not.toBeInTheDocument();
		});
	});

	// A press that something else stops before it reaches its target. The dismissal sees every
	// press at the document and follows it to its target, where it decides. A drag library that
	// swallows the click after a drag stops it on the way, so it never arrives: what was waiting
	// for it at the target must not act on a later click instead, with the stopped one's stale
	// data. The clicks are a drag's trailing clicks, with no press, so they are synthetic.
	describe("a press stopped before it reaches its target", () => {
		let removeStopper: (() => void) | undefined;

		afterEach(() => {
			removeStopper?.();
			removeStopper = undefined;
		});

		/** Stops the next `type` event at the document, on its way down, as a drag library does. */
		function stopNext(type: string) {
			const stop = (event: Event) => {
				event.stopPropagation();
				removeStopper?.();
			};
			document.addEventListener(type, stop, true);
			removeStopper = () => {
				document.removeEventListener(type, stop, true);
				removeStopper = undefined;
			};
		}

		async function setupStopped() {
			const onOpenChange = vi.fn<(...args: OpenChange) => void>();
			const { screen, popup } = await setup({ rootProps: { onOpenChange } });
			await expect.element(popup).toBeInTheDocument();
			return { screen, popup, onOpenChange };
		}

		it("keeps the popup open on the next click inside it, after a stopped click on the page", async () => {
			const { screen, popup, onOpenChange } = await setupStopped();

			// The click that ends a drag lands on the page and is swallowed.
			stopNext("click");
			dispatch(outside, "click");
			await expect.element(popup).toBeInTheDocument();

			dispatch(screen.getByTestId("input"), "click");
			await settle();

			await expect.element(popup).toBeInTheDocument();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("keeps the popup open on a click in its content, after a stopped click on the popup", async () => {
			const { screen, popup, onOpenChange } = await setupStopped();

			stopNext("click");
			dispatch(popup, "click");
			await expect.element(popup).toBeInTheDocument();

			// This click bubbles through the popup element, where the stopped one was awaited.
			dispatch(screen.getByTestId("input"), "click");
			await settle();

			await expect.element(popup).toBeInTheDocument();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("keeps the popup open through several clicks inside it after a stopped one", async () => {
			const { screen, popup, onOpenChange } = await setupStopped();

			stopNext("click");
			dispatch(outside, "click");
			dispatch(screen.getByTestId("input"), "click");
			dispatch(popup, "click");
			dispatch(screen.getByTestId("input"), "click");
			await settle();

			await expect.element(popup).toBeInTheDocument();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("still closes on a real outside click after a stopped one", async () => {
			const { popup, onOpenChange } = await setupStopped();

			stopNext("click");
			dispatch(outside, "click");
			await expect.element(popup).toBeInTheDocument();

			dispatch(outside, "click");

			await expect.element(popup).not.toBeInTheDocument();
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
			expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.outsidePress);
		});

		it("closes once, not twice, on the outside click after a stopped one", async () => {
			const { onOpenChange } = await setupStopped();

			stopNext("click");
			dispatch(outside, "click");
			dispatch(outside, "click");
			await settle();

			expect(onOpenChange.mock.calls.filter(([open]) => !open)).toHaveLength(1);
		});
	});

	// Escape while text is composed closes the composition, not the popup. The composition events
	// are an input method's, which no real key press here produces, so they are synthetic; the
	// Escape key is a real one wherever the case allows it. `input` is the field in the popup.
	describe("Escape and text composition", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		async function setupComposed() {
			const { screen, popup } = await setup();
			const input = screen.getByTestId("input");
			(input.element() as HTMLInputElement).focus();
			await expect.element(input).toHaveFocus();
			return { input, popup };
		}

		// One engine reports the end of a composition before the key that ended it, so there the
		// end counts a little longer (5ms) and that key is not the popup's. The others mark that
		// key themselves, so an Escape that follows the end at once is an ordinary one.
		it.skipIf(isWebKit)(
			"closes the popup where the key that ends a composition is marked",
			async () => {
				const { input, popup } = await setupComposed();
				dispatch(input, "compositionstart");
				dispatch(input, "compositionend");

				await userEvent.keyboard("{Escape}");

				await expect.element(popup).not.toBeInTheDocument();
			},
		);

		it.skipIf(!isWebKit)("stays open where the end is reported before its key", async () => {
			const { input, popup } = await setupComposed();
			// The 5ms the end counts for is the case: fake time holds it while the real key arrives.
			vi.useFakeTimers();
			dispatch(input, "compositionstart");
			dispatch(input, "compositionend");

			await userEvent.keyboard("{Escape}");
			await settle();
			await expect.element(popup).toBeInTheDocument();

			// A later Escape is the popup's again.
			vi.advanceTimersByTime(5);
			await userEvent.keyboard("{Escape}");
			await expect.element(popup).not.toBeInTheDocument();
		});

		it("closes the popup once the composing field is gone", async () => {
			const { input, popup } = await setupComposed();

			dispatch(input, "compositionstart");
			// The field is rewritten and the browser drops the composition: no `compositionend`.
			await userEvent.keyboard("{Escape}");

			await expect.element(popup).not.toBeInTheDocument();
		});

		it("stays open for an Escape that says it belongs to a composition", async () => {
			const { input, popup } = await setupComposed();

			// Key states an input method sets, which a real key press here does not.
			dispatch(input, "keydown", { key: "Escape", isComposing: true });
			await settle();
			await expect.element(popup).toBeInTheDocument();

			// The key code input methods report for a key they handle themselves.
			dispatch(input, "keydown", { key: "Escape", keyCode: 229 });
			await settle();
			await expect.element(popup).toBeInTheDocument();
		});
	});
});
