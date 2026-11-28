// The focus manager through a Popover: return focus and its `focusVisible`, a reference that
// changes while open, a nested click trigger, the inert marker, a manager that turns on while
// open, keep-mounted sessions, and the close type of a click.
// - The fixtures are Popovers (fixtures/focus-popover.svelte, focus-marker-popover.svelte,
//   focus-reference-switch-popover.svelte): the trigger is the reference, the return target is
//   the Popup's `finalFocus`, a kept-mounted manager is a `keepMounted` Portal, and the outside
//   buttons set the Root's bound `open`.
// - A Popover closes on an outside click unless `modal="trap-focus"`, which dismisses on
//   `pointerdown` too, so the cases with outside buttons or an outside `pointerdown` use it. With
//   a Popover.Close it also traps focus.
// - Initial focus lands on a real frame, so the tests wait for it with `waitFor`.
// - "does not return focus while open when the reference changes" switches the reference with the
//   Root's `triggerId`.
// - "true -> false" (prop `disabled`): Popover turns its manager off while hover-opened, and a
//   click on the trigger turns it on.
// - "uses the latest explicitReturnFocus value without moving focus while open": a Popover's
//   return is explicit while `finalFocus` is a function, so the change while open is `finalFocus`
//   going from `() => true` to unset.
// - "clears outside pointer state between keep-mounted open sessions" reads `store.data.insideTree`
//   through a store probe.
// - The unportalled popups of the marker cases keep the Popover's portal in the same parent as
//   the rest of the tree (its `container` is a `div` at the end of it).

import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";
import { describe, expect, it, vi } from "vitest";

import type { InteractionType } from "#lib/components/popover/popover-types.js";
import type { WebTypes } from "#lib/foundation/kernel/index.js";

import { act, createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";
import MarkerPopover from "./fixtures/focus-marker-popover.svelte";
import FfmPopover from "./fixtures/focus-popover.svelte";
import ReferenceSwitchPopover from "./fixtures/focus-reference-switch-popover.svelte";

const INERT = "data-sohedra-inert";

const flushMicrotasks = () => act(async () => {});

async function waitFrames(count: number) {
	for (let i = 0; i < count; i += 1) {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	}
	await flushMicrotasks();
}

describe("FloatingFocusManager", () => {
	const { render } = createRenderer();

	describe("prop: returnFocus", () => {
		it("passes focusVisible when returning focus after keyboard close", async () => {
			const { user } = await render(FfmPopover, { content: "empty" });

			const reference = screen.getByText("reference");
			await user.click(reference);
			await flushMicrotasks();

			await waitFor(() => {
				expect(screen.getByTestId("floating")).toHaveFocus();
			});

			const focusSpy = vi.spyOn(reference, "focus");

			try {
				await user.keyboard("{Escape}");

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({
						preventScroll: true,
						focusVisible: true,
					});
				});
			} finally {
				focusSpy.mockRestore();
			}
		});

		it("omits focusVisible when returning focus after pointer close", async () => {
			const { user } = await render(FfmPopover, { content: "empty" });

			const reference = screen.getByText("reference");
			await user.click(reference);
			await flushMicrotasks();

			await waitFor(() => {
				expect(screen.getByTestId("floating")).toHaveFocus();
			});

			const focusSpy = vi.spyOn(reference, "focus");

			try {
				// Closing with a pointer must not force `:focus-visible`; `focusVisible`
				// is omitted entirely so the browser's own heuristics decide.
				await user.click(reference);

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
				});
				expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
			} finally {
				focusSpy.mockRestore();
			}
		});

		it("does not return focus while open when the reference changes", async () => {
			const { user, setProps } = await render(ReferenceSwitchPopover, { triggerId: "first" });

			await user.click(screen.getByTestId("first"));
			await flushMicrotasks();

			const child = screen.getByTestId("child");
			await act(async () => {
				child.focus();
			});

			// The return-focus effect re-arms for the new reference while the popup stays open, so
			// the cleanup's queued return focus must be cancelled rather than yank focus mid-open.
			await setProps({ triggerId: "second" });
			await flushMicrotasks();

			expect(child).toHaveFocus();

			await user.click(screen.getByTestId("close"));
			await flushMicrotasks();

			// The cancelled job must not have left return focus suppressed for the real close.
			expect(screen.getByTestId("second")).toHaveFocus();
		});
	});

	describe("prop: modal", () => {
		it("clicking a nested click trigger does not suppress the next focus-out close", async () => {
			const { user } = await render(FfmPopover, { content: "nested-trigger", last: true });

			await user.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			await user.click(screen.getByTestId("nested-trigger"));
			await act(() => new Promise((resolve) => setTimeout(resolve)));

			await user.tab();
			await act(() => new Promise((resolve) => setTimeout(resolve)));

			expect(screen.queryByTestId("floating")).not.toBeInTheDocument();
			expect(screen.getByTestId("last")).toHaveFocus();
		});

		it("false - does not apply inert to outside nodes", async () => {
			await render(MarkerPopover, { layout: "outside-nodes" });

			fireEvent.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			expect(screen.getByTestId("floating")).not.toHaveAttribute("inert");
			expect(screen.getByTestId("aria-live")).not.toHaveAttribute("inert");
			expect(screen.getByTestId("btn-1")).not.toHaveAttribute("inert");
			expect(screen.getByTestId("btn-2")).not.toHaveAttribute("inert");
			expect(screen.getByTestId("reference")).toHaveAttribute(INERT);
			expect(screen.getByTestId("outside-wrapper")).toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);

			fireEvent.click(screen.getByTestId("reference"));

			expect(screen.getByTestId("reference")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("outside-wrapper")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
		});

		it("false - keeps marker on top-level outside ancestor when reference has siblings", async () => {
			await render(MarkerPopover, { layout: "reference-siblings" });

			fireEvent.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			expect(screen.getByTestId("floating")).not.toHaveAttribute("inert");
			expect(screen.getByTestId("outside-wrapper")).toHaveAttribute(INERT);
			expect(screen.getByTestId("outside-sibling")).toHaveAttribute(INERT);
			expect(screen.getByTestId("reference")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("nested-wrapper")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("nested-btn")).not.toHaveAttribute(INERT);

			fireEvent.click(screen.getByTestId("reference"));

			expect(screen.getByTestId("outside-wrapper")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("outside-sibling")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("reference")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-1")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("btn-2")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("nested-wrapper")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("nested-btn")).not.toHaveAttribute(INERT);
		});
	});

	describe("prop: disabled", () => {
		it("true -> false", async () => {
			await render(FfmPopover, {
				content: "empty",
				triggerProps: { openOnHover: true, delay: 0 },
			});

			const reference = screen.getByTestId("reference");
			fireEvent.mouseEnter(reference);
			fireEvent.mouseMove(reference);
			await waitFor(() => {
				expect(screen.queryByTestId("floating")).not.toBe(null);
			});
			await waitFrames(2);
			expect(screen.getByTestId("floating")).not.toHaveFocus();

			fireEvent.click(reference);
			await flushMicrotasks();
			await waitFor(() => {
				expect(screen.getByTestId("floating")).toHaveFocus();
			});
		});

		it("treats a returnFocus resolver returning true as explicit", async () => {
			const { user } = await render(FfmPopover, {
				rootProps: { modal: "trap-focus" },
				withClose: true,
				outsideClose: true,
				popupProps: { finalFocus: () => true },
			});

			await user.click(screen.getByTestId("reference"));
			await waitFor(() => {
				expect(screen.getByTestId("child")).toHaveFocus();
			});

			await user.click(screen.getByTestId("close"));

			await waitFor(() => {
				expect(screen.getByTestId("reference")).toHaveFocus();
			});
		});

		it("uses the latest explicitReturnFocus value without moving focus while open", async () => {
			const { user, setProps } = await render(FfmPopover, {
				outsideClose: true,
				popupProps: { finalFocus: () => true },
			});

			await user.click(screen.getByTestId("reference"));
			await waitFor(() => {
				expect(screen.getByTestId("child")).toHaveFocus();
			});

			await setProps({ popupProps: {} });
			expect(screen.getByTestId("child")).toHaveFocus();

			const close = screen.getByTestId("close");
			await user.click(close);
			await flushMicrotasks();
			expect(close).toHaveFocus();
		});

		it("resets close modality between keep-mounted open sessions", async () => {
			const finalFocus = vi.fn((_closeType: InteractionType) => true);

			const { user } = await render(FfmPopover, {
				rootProps: { modal: "trap-focus" },
				withClose: true,
				controlled: true,
				portalProps: { keepMounted: true },
				popupProps: { finalFocus },
			});

			const reference = screen.getByTestId("reference");
			const focusSpy = vi.spyOn(reference, "focus");

			try {
				await user.click(reference);
				await waitFor(() => {
					expect(screen.getByTestId("child")).toHaveFocus();
				});

				await user.keyboard("{Escape}");
				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({
						preventScroll: true,
						focusVisible: true,
					});
				});
				expect(finalFocus).toHaveBeenLastCalledWith("keyboard");

				focusSpy.mockClear();

				await user.click(reference);
				await waitFor(() => {
					expect(screen.getByTestId("child")).toHaveFocus();
				});

				fireEvent.click(screen.getByTestId("controlled-close"));

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
				});
				expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
				expect(finalFocus).toHaveBeenLastCalledWith("");

				focusSpy.mockClear();
				finalFocus.mockClear();

				fireEvent.click(screen.getByTestId("controlled-open"));
				await waitFor(() => {
					expect(screen.getByTestId("child")).toHaveFocus();
				});

				fireEvent.pointerDown(reference, { pointerType: "mouse" });
				fireEvent.click(screen.getByTestId("controlled-close"));

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
				});
				expect(focusSpy).not.toHaveBeenCalledWith(expect.objectContaining({ focusVisible: true }));
				expect(finalFocus).toHaveBeenCalledWith("");

				focusSpy.mockClear();
				finalFocus.mockClear();

				fireEvent.click(screen.getByTestId("controlled-open"));
				await waitFor(() => {
					expect(screen.getByTestId("child")).toHaveFocus();
				});

				fireEvent.click(reference, { detail: 0 });

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({
						preventScroll: true,
						focusVisible: true,
					});
				});
				expect(finalFocus).toHaveBeenCalledWith("keyboard");
			} finally {
				focusSpy.mockRestore();
			}
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

				await render(FfmPopover, { open: true, popupProps: { finalFocus } });

				const reference = screen.getByTestId("reference");

				if (pointerType) {
					fireEvent.pointerDown(reference, { pointerType });
				}
				// Synthesized click shape: `PointerEvent` with an empty `pointerType`.
				fireEvent(
					reference,
					new PointerEvent("click", { bubbles: true, cancelable: true, detail, pointerType: "" }),
				);

				await waitFor(() => {
					expect(finalFocus).toHaveBeenCalledWith(expected);
				});
			},
		);

		it("preserves keyboard close modality when reopening before focus restoration", async () => {
			const { user } = await render(FfmPopover, {
				rootProps: { modal: "trap-focus" },
				withClose: true,
				openState: true,
				reopenOnClose: true,
				portalProps: { keepMounted: true },
			});

			const reference = screen.getByTestId("reference");
			const focusSpy = vi.spyOn(reference, "focus");

			try {
				await user.click(reference);
				await waitFor(() => {
					expect(screen.getByTestId("child")).toHaveFocus();
				});

				fireEvent.click(screen.getByTestId("reopen-on-close"));
				await user.keyboard("{Escape}");

				await waitFor(() => {
					expect(focusSpy).toHaveBeenCalledWith({
						preventScroll: true,
						focusVisible: true,
					});
				});
				expect(screen.getByTestId("open-state")).toHaveTextContent("true");
			} finally {
				focusSpy.mockRestore();
			}
		});

		it("clears outside pointer state between keep-mounted open sessions", async () => {
			let store: PopoverStore<unknown, WebTypes> | undefined;
			const { user } = await render(FfmPopover, {
				rootProps: { modal: "trap-focus" },
				openState: true,
				before: true,
				after: true,
				portalProps: { keepMounted: true },
				onStore: (value) => {
					store = value;
				},
			});

			await user.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			await waitFor(() => {
				expect(screen.getByTestId("child")).toHaveFocus();
			});

			fireEvent.pointerDown(screen.getByTestId("after"));
			await flushMicrotasks();

			expect(screen.getByTestId("open-state")).toHaveTextContent("false");

			await user.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			await waitFor(() => {
				expect(screen.getByTestId("child")).toHaveFocus();
			});

			fireEvent.focusOut(screen.getByTestId("child"), {
				relatedTarget: screen.getByTestId("after"),
			});

			expect(store?.data.insideTree).toBe(true);
		});
	});

	describe("non-modal + FloatingPortal", () => {
		it("does not mark reference siblings due to outside focus guards", async () => {
			const { user } = await render(MarkerPopover, { layout: "portalled" });

			await user.click(screen.getByTestId("reference"));
			await flushMicrotasks();

			expect(screen.getByTestId("floating")).toBeInTheDocument();
			expect(screen.getByTestId("reference")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("reference-sibling-1")).not.toHaveAttribute(INERT);
			expect(screen.getByTestId("reference-sibling-2")).not.toHaveAttribute(INERT);
		});
	});
});
