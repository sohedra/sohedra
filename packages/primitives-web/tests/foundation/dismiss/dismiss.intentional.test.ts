import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";
import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
// Intentional outside presses, through a Popover. Two more cases run through a Dialog with a
// backdrop: a cancelled press, and a drag that ends on a target the dialog's own outside-press
// test ignores.
// - The popup is an initially open Popover (fixtures/dismiss-popover.svelte), whose mouse outside
//   press is `intentional`; its popup is `floating`. The reopening reference is the Popover
//   trigger, the `pointerdown`-opening button is `opener` (`openOnPointerDown`), the prevented
//   `scrubber` is `scrubber`, and the store the cases call `setOpen` on is the Root's (`onStore`),
//   whose details carry a `fallbackEvent()`.
// - "press survives listener re-attachment while open": a Popover has no dismissal option that
//   can change while open, so the fixture re-creates the Positioner (the floating element, which
//   the document listeners depend on) instead.
import { describe, expect, it } from "vitest";

import {
	createChangeEventDetails,
	fallbackEvent,
	type WebTypes,
} from "#lib/foundation/kernel/index.js";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import DismissPopover from "./fixtures/dismiss-popover.svelte";

const flushMicrotasks = () => act(async () => {});

const floating = () => screen.queryByTestId("floating");

describe("useDismiss", () => {
	const { render } = createRenderer();

	describe("outsidePressEvent: intentional", () => {
		it("dragging outside the floating element does not close", async () => {
			await render(DismissPopover);
			const floatingEl = screen.getByTestId("floating");
			fireEvent.mouseDown(floatingEl);
			fireEvent.mouseUp(document.body);
			expect(floating()).toBeInTheDocument();
			await flushMicrotasks();
		});

		it("dragging inside the floating element does not close", async () => {
			await render(DismissPopover);
			const floatingEl = screen.getByTestId("floating");
			fireEvent.mouseDown(document.body);
			fireEvent.mouseUp(floatingEl);
			// The browser fires the gesture's click on the common ancestor of the
			// mousedown and mouseup targets; the mouseup inside the floating element
			// marks the component tree so this click must not dismiss.
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();
			await flushMicrotasks();
		});

		it("dragging outside the floating element then clicking outside closes", async () => {
			await render(DismissPopover);
			const floatingEl = screen.getByTestId("floating");
			fireEvent.mouseDown(floatingEl);
			fireEvent.mouseUp(document.body);
			// A click event will have fired before the proper outside click.
			fireEvent.click(document.body);
			fireEvent.click(document.body);
			expect(floating()).not.toBeInTheDocument();
		});

		it("dragging outside the floating element then clicking outside closes with mouse clicks", async () => {
			await render(DismissPopover);
			const floatingEl = screen.getByTestId("floating");
			fireEvent.pointerDown(floatingEl, { pointerType: "mouse" });
			fireEvent.mouseDown(floatingEl);
			fireEvent.mouseUp(document.body);

			// Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
			// and is consumed by the one-shot drag suppression.
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();

			// The next press-backed mouse click closes.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("compatibility events whose pointerdown opened the floating element do not count as a new press", async () => {
			await render(DismissPopover, { open: false, openOnPointerDown: true });

			const openButton = screen.getByTestId("opener");
			fireEvent.pointerDown(openButton, { pointerType: "mouse" });
			expect(floating()).toBeInTheDocument();

			// The pointerdown happened before the floating element opened. Its
			// compatibility events arrive after opening but belong to the same press.
			fireEvent.mouseDown(openButton);
			fireEvent.mouseUp(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();

			// A new pointer press that begins while open still dismisses.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("press-less outside click reporting a pointer type closes", async () => {
			await render(DismissPopover);

			// Android assistive technology reports `pointerType: 'mouse'` with no press behind
			// it, so the click count is what separates the two.
			const click = new MouseEvent("click", { bubbles: true, detail: 0 });
			Object.defineProperty(click, "pointerType", { value: "mouse" });
			fireEvent(document.body, click);
			expect(floating()).not.toBeInTheDocument();
		});

		it("press seen in a previous open session does not leak into a reopen", async () => {
			await render(DismissPopover);

			// A genuine outside press closes and leaves a press on record.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();

			fireEvent.click(screen.getByTestId("reference"));
			expect(floating()).toBeInTheDocument();

			// The reopened session must not inherit the previous session's press:
			// a press-less trailing click still must not count as an outside press.
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();

			// A press observed in the new session still closes.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("press seen before a same-batch close and reopen does not leak into the new session", async () => {
			let store!: PopoverStore<unknown, WebTypes>;
			await render(DismissPopover, {
				onStore: (value) => {
					store = value;
				},
			});

			// A press lands while the first session is open.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);

			// Nothing renders `open === false` here, so only `openchange` can observe the
			// session boundary.
			await act(() => {
				store.setOpen(false, createChangeEventDetails(REASONS.none, fallbackEvent()) as never);
				store.setOpen(true, createChangeEventDetails(REASONS.none, fallbackEvent()) as never);
			});
			expect(floating()).toBeInTheDocument();

			// The gesture's trailing click belongs to the previous session and must
			// not dismiss the reopened floating element.
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();

			// A press observed in the new session still closes.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("press survives a redundant open dispatch while already open", async () => {
			let store!: PopoverStore<unknown, WebTypes>;
			await render(DismissPopover, {
				onStore: (value) => {
					store = value;
				},
			});

			// A genuine outside press lands while open.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);

			// A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
			// does not end the session, so the press stays on record.
			await act(() => {
				store.setOpen(true, createChangeEventDetails(REASONS.none, fallbackEvent()) as never);
			});
			expect(floating()).toBeInTheDocument();

			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("press survives listener re-attachment while open", async () => {
			const { setProps } = await render(DismissPopover);
			const positioner = screen.getByTestId("floating").parentElement;

			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.mouseDown(document.body);

			// Changing an effect dependency mid-gesture re-attaches the document listeners;
			// the observed press must survive that.
			await setProps({ popupKey: 1 });
			expect(screen.getByTestId("floating").parentElement).not.toBe(positioner);

			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("non-primary-button press does not count as an outside press", async () => {
			await render(DismissPopover);

			// A right-button press produces `contextmenu`, not `click`, so it must
			// not vouch for a later press-less click.
			fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 2 });
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).toBeInTheDocument();

			// A primary-button press still closes.
			fireEvent.pointerDown(document.body, { pointerType: "mouse" });
			fireEvent.click(document.body, { detail: 1 });
			expect(floating()).not.toBeInTheDocument();
		});

		it("inside click then programmatic outside click closes", async () => {
			await render(DismissPopover);
			const insideInput = screen.getByRole("textbox");

			fireEvent.mouseDown(insideInput);
			fireEvent.mouseUp(insideInput);
			fireEvent.click(insideInput);
			expect(floating()).toBeInTheDocument();

			fireEvent.click(document.body);
			expect(floating()).not.toBeInTheDocument();
		});

		it("inside click after drag does not cause immediate close on first outside click", async () => {
			await render(DismissPopover);
			const floatingEl = screen.getByTestId("floating");
			const insideInput = screen.getByRole("textbox");

			fireEvent.mouseDown(floatingEl);
			fireEvent.mouseUp(document.body);

			// Inside clicks should never dismiss, and they should not consume the
			// one-shot outside click suppression from the drag that started inside.
			fireEvent.click(insideInput);
			expect(floating()).toBeInTheDocument();

			// First true outside click after that drag is still ignored once.
			fireEvent.click(document.body);
			expect(floating()).toBeInTheDocument();

			// The next outside click is a deliberate outside press and dismisses.
			fireEvent.click(document.body);
			expect(floating()).not.toBeInTheDocument();
		});

		it("press start prevented inside suppresses only immediate outside click", async () => {
			await render(DismissPopover, { scrubber: true });
			const scrubber = screen.getByTestId("scrubber");

			fireEvent.pointerDown(scrubber, { pointerType: "mouse", button: 0 });
			fireEvent.mouseDown(scrubber, { button: 0 });
			fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
			fireEvent.mouseUp(document.body, { button: 0 });

			fireEvent.click(document.body);
			expect(floating()).toBeInTheDocument();

			await act(async () => {
				await new Promise((resolve) => {
					setTimeout(resolve, 0);
				});
			});

			fireEvent.click(document.body);
			expect(floating()).not.toBeInTheDocument();
		});

		it("pointercancel after prevented press start suppresses immediate outside click", async () => {
			await render(DismissPopover, { scrubber: true });
			const scrubber = screen.getByTestId("scrubber");

			fireEvent.pointerDown(scrubber, { pointerType: "mouse", button: 0 });
			fireEvent.mouseDown(scrubber, { button: 0 });
			fireEvent.pointerCancel(document.body, { pointerType: "mouse" });

			fireEvent.click(document.body);
			expect(floating()).toBeInTheDocument();

			await act(async () => {
				await new Promise((resolve) => {
					setTimeout(resolve, 0);
				});
			});

			fireEvent.click(document.body);
			expect(floating()).not.toBeInTheDocument();
		});
	});
});
