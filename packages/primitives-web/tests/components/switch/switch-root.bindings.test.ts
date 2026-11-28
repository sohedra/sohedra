// What Switch.Root does with Svelte's own means: the controlled pattern, a parent's plain value,
// function bindings, the native input and change events they gate, preventSohedraHandler, its
// context, and a render snippet's own handler.
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import type { SwitchRootChangeEventDetails } from "#lib/components/switch/switch-types.js";

import { hiddenInput } from "../../kit/kit-form.js";
import SwitchDemo from "./fixtures/switch-demo.svelte";
import SwitchRootContextValue from "./fixtures/switch-root-context-value.svelte";
import SwitchRootControlled from "./fixtures/switch-root-controlled.svelte";
import SwitchRootFunctionBound from "./fixtures/switch-root-function-bound.svelte";
import SwitchRootParentValue from "./fixtures/switch-root-parent-value.svelte";
import SwitchRootPreventHandler from "./fixtures/switch-root-prevent-handler.svelte";
import SwitchRootRenderOwnHandler from "./fixtures/switch-root-render-own-handler.svelte";
import SwitchRootWithContextValue from "./fixtures/switch-root-with-context-value.svelte";

afterEach(() => {
	vi.restoreAllMocks();
});

// An empty switch has no size, and userEvent only clicks visible elements.
const SIZED = "display: inline-block; width: 16px; height: 16px";

const cancel = (_checked: boolean, details: SwitchRootChangeEventDetails) => details.cancel();

describe("Switch.Root", () => {
	// A parent that stores the value it already had can't be told from one that ignored the change,
	// so rejecting goes through `details.cancel()`.
	describe("the controlled pattern (checked + onCheckedChange)", () => {
		it("follows the value the parent stores", async () => {
			const screen = await render(SwitchRootControlled);
			const root = screen.getByRole("switch");

			await userEvent.click(root);
			await expect.element(root).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput(screen.container).checked).toBe(true);

			await userEvent.click(root);
			await expect.element(root).toHaveAttribute("aria-checked", "false");
		});
	});

	it("follows a parent's new checked value after a local toggle", async () => {
		const screen = await render(SwitchRootParentValue);
		const root = screen.getByRole("switch");
		await expect.element(root).toHaveAttribute("aria-checked", "false");

		await userEvent.click(root);
		await expect.element(root).toHaveAttribute("aria-checked", "true");

		// Like a native checkbox's `checked={x}`, re-setting the parent's unchanged value is no change.
		screen.component.setChecked(false);
		flushSync();
		await expect.element(root).toHaveAttribute("aria-checked", "true");

		screen.component.setChecked(true);
		flushSync();
		await expect.element(root).toHaveAttribute("aria-checked", "true");

		screen.component.setChecked(false);
		flushSync();
		await expect.element(root).toHaveAttribute("aria-checked", "false");

		screen.component.setChecked(true);
		flushSync();
		await expect.element(root).toHaveAttribute("aria-checked", "true");
	});

	describe("a function binding", () => {
		it("does not call the bound setter when onCheckedChange cancels", async () => {
			const set = vi.fn();
			const screen = await render(SwitchRootFunctionBound, {
				get: () => false,
				set,
				style: SIZED,
				onCheckedChange: cancel,
			});

			await userEvent.click(screen.getByRole("switch"));
			flushSync();

			expect(set).toHaveBeenCalledTimes(0);
			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput(screen.container).checked).toBe(false);
		});

		it("keeps the hidden input in sync when a function-binding setter declines", async () => {
			const set = vi.fn();
			const screen = await render(SwitchRootFunctionBound, { get: () => false, set, style: SIZED });

			await userEvent.click(screen.getByRole("switch"));
			flushSync();

			expect(set).toHaveBeenCalledWith(true);
			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput(screen.container).checked).toBe(false);
		});

		it("runs onCheckedChange before the bound setter", async () => {
			const calls: string[] = [];
			let value = false;
			const screen = await render(SwitchRootFunctionBound, {
				get: () => value,
				set: (next: boolean) => {
					calls.push("setter");
					value = next;
				},
				style: SIZED,
				onCheckedChange: () => calls.push("onCheckedChange"),
			});

			await userEvent.click(screen.getByRole("switch"));

			expect(calls).toEqual(["onCheckedChange", "setter"]);
		});
	});

	it("lets onclick skip the switch's handler with preventSohedraHandler()", async () => {
		const screen = await render(SwitchRootPreventHandler);
		const root = screen.getByRole("switch");

		await userEvent.click(root);

		await expect.element(root).toHaveAttribute("data-prevented", "true");
		await expect.element(root).toHaveAttribute("aria-checked", "false");
	});

	describe("native input and change events", () => {
		function listen(container: HTMLElement) {
			const events: { type: string; target: EventTarget | null; bubbles: boolean }[] = [];
			const record = (event: Event) =>
				events.push({ type: event.type, target: event.target, bubbles: event.bubbles });
			container.addEventListener("input", record);
			container.addEventListener("change", record);
			return events;
		}

		it("fires bubbling input and change from the hidden input on an accepted change", async () => {
			const screen = await render(SwitchDemo);
			const events = listen(screen.container);

			await userEvent.click(screen.getByRole("switch"));

			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
			expect(events).toEqual([
				{ type: "input", target: hiddenInput(screen.container), bubbles: true },
				{ type: "change", target: hiddenInput(screen.container), bubbles: true },
			]);
		});

		it("fires neither when onCheckedChange cancels", async () => {
			const screen = await render(SwitchDemo, { onCheckedChange: cancel });
			const events = listen(screen.container);

			await userEvent.click(screen.getByRole("switch"));
			flushSync();

			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
			expect(events).toEqual([]);
		});

		it("fires neither when a function-binding setter declines", async () => {
			const set = vi.fn();
			const screen = await render(SwitchRootFunctionBound, {
				get: () => false,
				set,
				style: SIZED,
			});
			const events = listen(screen.container);

			await userEvent.click(screen.getByRole("switch"));
			flushSync();

			expect(set).toHaveBeenCalledWith(true);
			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
			expect(events).toEqual([]);
		});
	});

	describe("SwitchRootContext", () => {
		it("shares its state with parts through SwitchRootContext", async () => {
			const screen = await render(SwitchRootWithContextValue, { style: SIZED });
			const context = screen.getByTestId("context");
			await expect.element(context).toHaveTextContent("unchecked");

			await userEvent.click(screen.getByRole("switch"));

			await expect.element(context).toHaveTextContent("checked");
			await expect.element(context).not.toHaveTextContent("unchecked");
		});

		it("throws SwitchRootContext's message outside Switch.Root", async () => {
			await expect(render(SwitchRootContextValue)).rejects.toThrow(
				"SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.",
			);
		});
	});

	// When a `render` snippet writes a handler for the same event after the spread, Svelte lets the
	// later attribute win, so the snippet's handler replaces the merged one. The tests record that;
	// they don't decide whether `Part` should do anything about it.
	describe("a render snippet with its own handler after the spread", () => {
		it("runs the snippet's handler and loses the part's own", async () => {
			const mine = vi.fn();
			const screen = await render(SwitchRootRenderOwnHandler, { mine });
			const element = screen.getByRole("switch");

			await userEvent.click(element);

			expect(mine).toHaveBeenCalledTimes(1);
			// The part's click handler did not run: the switch did not toggle.
			await expect.element(element).toHaveAttribute("aria-checked", "false");
		});

		it("keeps the part's handlers for the other events", async () => {
			const screen = await render(SwitchRootRenderOwnHandler, { mine: vi.fn() });
			const element = screen.getByRole("switch");

			// Space goes through the part's keyup handler, which clicks the element: the snippet's
			// `onclick` takes that click too, so the switch still does not toggle.
			await userEvent.tab();
			await expect.element(element).toHaveFocus();
			await userEvent.keyboard(" ");

			await expect.element(element).toHaveAttribute("aria-checked", "false");
		});
	});
});
