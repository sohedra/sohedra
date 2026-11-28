// The focus manager through a Popover: where focus returns on close and with which
// `focusVisible`, the close type a click reports, the inert marker of a non-modal popup, a manager
// that turns on while open, keep-mounted sessions, focus leaving the trigger of a closed popover,
// and a focused element removed from the popup.
// - The fixtures are Popovers (fixtures/focus-popover.svelte and the scenario fixtures beside it):
//   the trigger is the anchor, the return target is the Popup's `finalFocus`, a kept-mounted
//   manager is a `keepMounted` Portal, and the outside buttons set the Root's bound `open`.
// - A Popover closes on an outside click unless `modal="trap-focus"`, which dismisses on
//   `pointerdown` too, so the cases with outside buttons or an outside `pointerdown` use it. With
//   a Popover.Close it also traps focus.
// - "true -> false" (the manager's `disabled`): Popover turns its manager off while hover-opened,
//   and a click on the trigger turns it on.
// - "uses the latest explicitReturnFocus value without moving focus while open": a Popover's
//   return is explicit while `finalFocus` is a function, so the change while open is `finalFocus`
//   going from `() => true` to unset.
// - The unportalled popups of the marker cases keep the Popover's portal in the same parent as
//   the rest of the tree (its `container` is a `div` at the end of it).
import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";
import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import testingUserEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { server, userEvent } from "vitest/browser";

import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";
import type { WebTypes } from "#lib/foundation/kernel/index.js";
import type { InteractionType } from "#lib/index.js";

import { dispatch } from "../../kit/kit-events.js";
import { holdFrames, nextFrame, nextTask, settle } from "../../kit/kit-frames.js";
import MarkerPopover from "./fixtures/focus-marker-popover.svelte";
import FocusPopover from "./fixtures/focus-popover.svelte";
import RemovalPopover from "./fixtures/focus-removal-popover.svelte";
import TriggerChangePopover from "./fixtures/focus-trigger-change-popover.svelte";

const INERT = "data-sohedra-inert";

const isWebKit = server.browser === "webkit";

/** Testing Library's simulated input, for the cases a real pointer cannot keep (see each case). */
const simulatedUser = testingUserEvent.setup();

type OpenChange = [open: boolean, details: PopoverRootChangeEventDetails];

/** The closes `onOpenChange` heard, as `[open, reason]`. */
function closes(onOpenChange: ReturnType<typeof vi.fn>) {
	return (onOpenChange.mock.calls as OpenChange[])
		.filter(([open]) => !open)
		.map(([open, details]) => [open, details.reason]);
}

/** Renders the focus Popover with `props` and opens it with a click on its trigger. */
async function openWithClick(props: Parameters<typeof render<typeof FocusPopover>>[1] = {}) {
	const screen = await render(FocusPopover, props);
	const anchor = screen.getByTestId("anchor");
	await userEvent.click(anchor);
	return { screen, anchor };
}

describe("FocusManager", () => {
	describe("returnFocus", () => {
		it("passes focusVisible when returning focus after keyboard close", async () => {
			const { screen, anchor } = await openWithClick({ content: "empty" });
			await expect.element(screen.getByTestId("popup")).toHaveFocus();
			const focusSpy = vi.spyOn(anchor.element() as HTMLElement, "focus");

			await userEvent.keyboard("{Escape}");

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true });
			});
		});

		it("omits focusVisible when returning focus after pointer close", async () => {
			const { screen, anchor } = await openWithClick({ content: "empty" });
			await expect.element(screen.getByTestId("popup")).toHaveFocus();
			const focusSpy = vi.spyOn(anchor.element() as HTMLElement, "focus");

			// Closing with a pointer must not force `:focus-visible`; `focusVisible` is omitted
			// entirely so the browser's own heuristics decide.
			await userEvent.click(anchor);

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
			});
			expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
		});

		it("does not return focus while open when the anchor changes", async () => {
			const screen = await render(TriggerChangePopover, { triggerId: "first" });
			await userEvent.click(screen.getByTestId("first"));
			const child = screen.getByTestId("child");
			await expect.element(child).toBeInTheDocument();
			(child.element() as HTMLElement).focus();

			// The return-focus effect re-arms for the new anchor while the popup stays open, so
			// the cleanup's queued return focus must be cancelled rather than yank focus mid-open.
			await screen.rerender({ triggerId: "second" });
			await nextFrame();

			await expect.element(child).toHaveFocus();

			await userEvent.click(screen.getByTestId("close"));

			// The cancelled job must not have left return focus suppressed for the real close.
			await expect.element(screen.getByTestId("second")).toHaveFocus();
		});

		it("treats a returnFocus resolver returning true as explicit", async () => {
			const { screen, anchor } = await openWithClick({
				rootProps: { modal: "trap-focus" },
				withClose: true,
				outsideClose: true,
				popupProps: { finalFocus: () => true },
			});
			await expect.element(screen.getByTestId("child")).toHaveFocus();

			// Simulated input, as before: with a real click the browser's mousedown focuses the
			// clicked button after the outside press has returned focus to the trigger.
			await simulatedUser.click(screen.getByTestId("close").element());

			await expect.element(anchor).toHaveFocus();
		});

		it("uses the latest explicitReturnFocus value without moving focus while open", async () => {
			const { screen } = await openWithClick({
				outsideClose: true,
				popupProps: { finalFocus: () => true },
			});
			const child = screen.getByTestId("child");
			await expect.element(child).toHaveFocus();

			await screen.rerender({ popupProps: {} });
			await expect.element(child).toHaveFocus();

			const close = screen.getByTestId("close");
			// Simulated input, as before: a real click in WebKit leaves the clicked button unfocused.
			await simulatedUser.click(close.element());
			await nextFrame();
			await expect.element(close).toHaveFocus();
		});
	});

	describe("the close type", () => {
		it("resets close modality between keep-mounted open sessions", async () => {
			const finalFocus = vi.fn((_closeType: InteractionType) => true);
			const { screen, anchor } = await openWithClick({
				rootProps: { modal: "trap-focus" },
				withClose: true,
				controlled: true,
				portalProps: { keepMounted: true },
				popupProps: { finalFocus },
			});
			const child = screen.getByTestId("child");
			const focusSpy = vi.spyOn(anchor.element() as HTMLElement, "focus");
			await expect.element(child).toHaveFocus();

			await userEvent.keyboard("{Escape}");
			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true });
			});
			expect(finalFocus).toHaveBeenLastCalledWith("keyboard");

			focusSpy.mockClear();

			await userEvent.click(anchor);
			await expect.element(child).toHaveFocus();

			// A script's click on an outside button: a close with no pointer or key behind it.
			dispatch(screen.getByTestId("controlled-close"), "click");

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
			});
			expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
			expect(finalFocus).toHaveBeenLastCalledWith("");

			focusSpy.mockClear();
			finalFocus.mockClear();

			dispatch(screen.getByTestId("controlled-open"), "click");
			await expect.element(child).toHaveFocus();

			// A mouse pointerdown on the trigger with no click after it, then a script's close.
			dispatch(anchor, "pointerdown", { pointerType: "mouse" });
			dispatch(screen.getByTestId("controlled-close"), "click");

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
			});
			expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
			expect(finalFocus).toHaveBeenCalledWith("");

			focusSpy.mockClear();
			finalFocus.mockClear();

			dispatch(screen.getByTestId("controlled-open"), "click");
			await expect.element(child).toHaveFocus();

			// A click with no click count, as a key press on the trigger reports it.
			dispatch(anchor, "click", { detail: 0 });

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true });
			});
			expect(finalFocus).toHaveBeenCalledWith("keyboard");
		});

		it.each<{
			name: string;
			pointerType: string | null;
			detail: number;
			expected: InteractionType;
		}>([
			{
				name: "zero detail after a mouse pointerdown",
				pointerType: "mouse",
				detail: 0,
				expected: "keyboard",
			},
			{
				name: "nonzero detail after a touch pointerdown",
				pointerType: "touch",
				detail: 1,
				expected: "touch",
			},
			{
				name: "nonzero detail after a pen pointerdown",
				pointerType: "pen",
				detail: 1,
				expected: "pen",
			},
			{
				name: "nonzero detail without a pointerdown",
				pointerType: null,
				detail: 1,
				expected: "mouse",
			},
		])(
			"classifies a click with an empty pointerType: $name",
			async ({ pointerType, detail, expected }) => {
				const finalFocus = vi.fn((_closeType: InteractionType) => true);
				const screen = await render(FocusPopover, { open: true, popupProps: { finalFocus } });
				const anchor = screen.getByTestId("anchor");

				// Pointer types and a click shape no real pointer here produces: a PointerEvent click
				// with an empty pointerType, after a pointerdown of the given type.
				if (pointerType) {
					dispatch(anchor, "pointerdown", { pointerType });
				}
				dispatch(
					anchor,
					new PointerEvent("click", { bubbles: true, cancelable: true, detail, pointerType: "" }),
				);

				await vi.waitFor(() => {
					expect(finalFocus).toHaveBeenCalledWith(expected);
				});
			},
		);

		it("preserves keyboard close modality when reopening before focus restoration", async () => {
			const { screen, anchor } = await openWithClick({
				rootProps: { modal: "trap-focus" },
				withClose: true,
				openState: true,
				reopenOnClose: true,
				portalProps: { keepMounted: true },
			});
			const focusSpy = vi.spyOn(anchor.element() as HTMLElement, "focus");
			await expect.element(screen.getByTestId("child")).toHaveFocus();

			// A script's click arms the reopen; a real one would press outside and close.
			dispatch(screen.getByTestId("reopen-on-close"), "click");
			await userEvent.keyboard("{Escape}");

			await vi.waitFor(() => {
				expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true });
			});
			await expect.element(screen.getByTestId("open-state")).toHaveTextContent("true");
		});
	});

	describe("modal", () => {
		it("clicking a nested click trigger does not suppress the next focus-out close", async () => {
			const { screen } = await openWithClick({ content: "nested-trigger", last: true });

			await userEvent.click(screen.getByTestId("nested-trigger"));
			await nextTask();

			await userEvent.tab();

			await expect.element(screen.getByTestId("popup")).not.toBeInTheDocument();
			await expect.element(screen.getByTestId("last")).toHaveFocus();
		});

		it("false - does not apply inert to outside nodes", async () => {
			const screen = await render(MarkerPopover, { layout: "outside-nodes" });
			const anchor = screen.getByTestId("anchor");

			await userEvent.click(anchor);

			await expect.element(anchor).toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("outside-wrapper")).toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("popup")).not.toHaveAttribute("inert");
			await expect.element(screen.getByTestId("aria-live")).not.toHaveAttribute("inert");
			await expect.element(screen.getByTestId("btn-1")).not.toHaveAttribute("inert");
			await expect.element(screen.getByTestId("btn-2")).not.toHaveAttribute("inert");
			await expect.element(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);

			await userEvent.click(anchor);

			await expect.element(anchor).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("outside-wrapper")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
		});

		it("false - keeps marker on top-level outside ancestor when anchor has siblings", async () => {
			const screen = await render(MarkerPopover, { layout: "anchor-siblings" });
			const anchor = screen.getByTestId("anchor");

			await userEvent.click(anchor);

			await expect.element(screen.getByTestId("outside-wrapper")).toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("outside-sibling")).toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("popup")).not.toHaveAttribute("inert");
			await expect.element(anchor).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("nested-wrapper")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("nested-btn")).not.toHaveAttribute(INERT);

			await userEvent.click(anchor);

			await expect.element(screen.getByTestId("outside-wrapper")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("outside-sibling")).not.toHaveAttribute(INERT);
			await expect.element(anchor).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("nested-wrapper")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("nested-btn")).not.toHaveAttribute(INERT);
		});

		it("does not mark anchor siblings due to outside focus guards", async () => {
			const screen = await render(MarkerPopover, { layout: "portalled" });
			const anchor = screen.getByTestId("anchor");

			await userEvent.click(anchor);

			await expect.element(screen.getByTestId("popup")).toBeInTheDocument();
			await expect.element(anchor).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("anchor-sibling-1")).not.toHaveAttribute(INERT);
			await expect.element(screen.getByTestId("anchor-sibling-2")).not.toHaveAttribute(INERT);
		});
	});

	describe("disabled", () => {
		it("true -> false", async () => {
			const screen = await render(FocusPopover, {
				content: "empty",
				triggerProps: { openOnHover: true, delay: 0 },
			});
			const anchor = screen.getByTestId("anchor");
			const popup = screen.getByTestId("popup");

			await userEvent.hover(anchor);
			await expect.poll(() => popup.query()).not.toBe(null);
			await nextFrame();
			await nextFrame();
			await expect.element(popup).not.toHaveFocus();

			await userEvent.click(anchor);
			await expect.element(popup).toHaveFocus();
		});
	});

	describe("keep-mounted sessions", () => {
		it("clears outside pointer state between keep-mounted open sessions", async () => {
			let store: PopoverStore<unknown, WebTypes> | undefined;
			const { screen, anchor } = await openWithClick({
				rootProps: { modal: "trap-focus" },
				openState: true,
				before: true,
				after: true,
				portalProps: { keepMounted: true },
				onStore: (value) => {
					store = value;
				},
			});
			const child = screen.getByTestId("child");
			await expect.element(child).toHaveFocus();

			// An outside pointerdown alone: the record it leaves must not reach the next session.
			dispatch(screen.getByTestId("after"), "pointerdown");

			await expect.element(screen.getByTestId("open-state")).toHaveTextContent("false");

			await userEvent.click(anchor);
			await expect.element(child).toHaveFocus();

			// A focusout toward an outside element with no focus move behind it: what the store
			// records for it is the case.
			dispatch(child, "focusout", { relatedTarget: screen.getByTestId("after").element() });

			expect(store?.dismiss.insideTree).toBe(true);
		});
	});

	describe("focus leaving the trigger of a closed popover", () => {
		// The manager keeps listening while the closed popup is still mounted (an exit animation,
		// or a close the app keeps mounted with `preventUnmountOnClose()`), and the close it queues
		// when focus leaves runs a microtask later, so it must not report a `focus-out` close for
		// a popup that is already closed.
		async function setup(onOpenChange: (...args: OpenChange) => void) {
			const { screen, anchor } = await openWithClick({
				rootProps: { onOpenChange },
				before: true,
				after: true,
			});
			await expect.element(screen.getByTestId("child")).toHaveFocus();
			return { screen, trigger: anchor };
		}

		it("reports one close when Shift+Tab leaves the trigger", async () => {
			const onOpenChange = vi.fn();
			const { screen, trigger } = await setup(onOpenChange);
			// From the popup's first element back to the trigger, then on to what comes before it.
			await userEvent.tab({ shift: true });
			await expect.element(trigger).toHaveFocus();
			onOpenChange.mockClear();

			await userEvent.tab({ shift: true });

			await expect.element(screen.getByTestId("before")).toHaveFocus();
			expect(closes(onOpenChange)).toEqual([[false, REASONS.focusOut]]);
		});

		it("reports nothing when the popover was closed and kept mounted", async () => {
			const onOpenChange = vi.fn((open: boolean, details: PopoverRootChangeEventDetails) => {
				if (!open) {
					details.preventUnmountOnClose();
				}
			});
			const { screen, trigger } = await setup(onOpenChange);
			await userEvent.keyboard("{Escape}");
			await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
			// Closed, and still in the document.
			expect(screen.getByTestId("popup").query()).not.toBe(null);
			onOpenChange.mockClear();

			// The app moves focus off the trigger and back, twice.
			const after = screen.getByTestId("after").element() as HTMLElement;
			(trigger.element() as HTMLElement).focus();
			after.focus();
			await settle();
			(trigger.element() as HTMLElement).focus();
			after.focus();
			await nextTask();

			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it("still closes an open popover when focus leaves its trigger", async () => {
			const onOpenChange = vi.fn();
			const { screen, trigger } = await setup(onOpenChange);
			(trigger.element() as HTMLElement).focus();
			await settle();
			onOpenChange.mockClear();

			(screen.getByTestId("after").element() as HTMLElement).focus();

			await vi.waitFor(() => {
				expect(closes(onOpenChange)).toEqual([[false, REASONS.focusOut]]);
			});
			await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
		});
	});

	// The focused element is removed: focus falls to the body, so the manager focuses the popup,
	// and once more on the next frame, for the browsers that hand focus back to the removed element
	// in between. That second focus must not take focus the app has moved meanwhile. The frames are
	// held, then run by the test, so the order is fixed. WebKit fires no `focusout` when a focused
	// element is removed, so the manager never hears of the removal there.
	describe("a focused element removed from a popover", () => {
		async function setup() {
			const screen = await render(RemovalPopover);
			await userEvent.click(screen.getByTestId("anchor"));
			await expect.element(screen.getByTestId("remove")).toHaveFocus();
			const frames = holdFrames();
			const popup = screen.getByTestId("popup");
			screen.component.removeFocused();
			// Focus fell to the body and the popup took it.
			await expect.element(popup).toHaveFocus();
			return { screen, frames, popup };
		}

		it.skipIf(isWebKit)("leaves focus where the app moved it before the next frame", async () => {
			const { screen, frames } = await setup();
			const other = screen.getByTestId("other");
			(other.element() as HTMLElement).focus();

			frames.run();

			await expect.element(other).toHaveFocus();
		});

		it.skipIf(isWebKit)(
			"focuses the popup again when focus is lost again before the next frame",
			async () => {
				const { frames, popup } = await setup();
				(popup.element() as HTMLElement).blur();
				await expect.element(document.body).toHaveFocus();

				frames.run();

				await expect.element(popup).toHaveFocus();
			},
		);
	});
});
