// Switch.Root behaviour beyond the main suite: Svelte bindings, the native input/change
// events, preventSohedraHandler, the context, and the spec cases kept from the previous library.
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import SwitchRoot from "#lib/components/switch/switch-root.svelte";
import type { SwitchRootChangeEventDetails } from "#lib/components/switch/types.js";

import SwitchRootBound from "./fixtures/switch-root-bound.svelte";
import SwitchRootContextValue from "./fixtures/switch-root-context-value.svelte";
import SwitchRootControlled from "./fixtures/switch-root-controlled.svelte";
import SwitchRootFunctionBound from "./fixtures/switch-root-function-bound.svelte";
import SwitchRootInLabel from "./fixtures/switch-root-in-label.svelte";
import SwitchRootParentValue from "./fixtures/switch-root-parent-value.svelte";
import SwitchRootPreventHandler from "./fixtures/switch-root-prevent-handler.svelte";
import SwitchRootWithContextValue from "./fixtures/switch-root-with-context-value.svelte";
import SwitchRootWithLabels from "./fixtures/switch-root-with-labels.svelte";

afterEach(() => {
	vi.restoreAllMocks();
});

// An empty switch has no size, and userEvent only clicks visible elements.
const SIZED = "display: inline-block; width: 16px; height: 16px";

const cancel = (_checked: boolean, details: SwitchRootChangeEventDetails) => details.cancel();

function getSwitch() {
	return page.getByRole("switch");
}

function hiddenInput() {
	return document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

describe("Switch.Root (Sohedra)", () => {
	// A parent that stores the value it already had can't be told from one that ignored the change,
	// so rejecting goes through `details.cancel()`.
	describe("the controlled pattern (checked + onCheckedChange)", () => {
		it("follows the value the parent stores", async () => {
			await render(SwitchRootControlled);

			await userEvent.click(getSwitch());
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput().checked).toBe(true);

			await userEvent.click(getSwitch());
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
		});
	});

	it("starts from defaultChecked when checked isn't given", async () => {
		await render(SwitchRoot, { defaultChecked: true });
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
		expect(hiddenInput().checked).toBe(true);
	});

	it("follows a parent's new checked value after a local toggle", async () => {
		const { component } = await render(SwitchRootParentValue);
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");

		await userEvent.click(getSwitch());
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");

		// Like a native checkbox's `checked={x}`, re-setting the parent's unchanged value is no change.
		component.setChecked(false);
		flushSync();
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");

		component.setChecked(true);
		flushSync();
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");

		component.setChecked(false);
		flushSync();
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");

		component.setChecked(true);
		flushSync();
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
	});

	describe("bind:checked", () => {
		it("writes the new value through bind:checked", async () => {
			const { getByTestId } = await render(SwitchRootBound, { initial: false, style: SIZED });
			await expect.element(getByTestId("bound")).toHaveTextContent("false");

			await userEvent.click(getSwitch());

			await expect.element(getByTestId("bound")).toHaveTextContent("true");
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
		});

		it("writes defaultChecked to a bound undefined value", async () => {
			const { getByTestId } = await render(SwitchRootBound, { defaultChecked: true });
			await expect.element(getByTestId("bound")).toHaveTextContent("true");
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
		});

		it("does not call the bound setter when onCheckedChange cancels", async () => {
			const set = vi.fn();
			await render(SwitchRootFunctionBound, {
				get: () => false,
				set,
				style: SIZED,
				onCheckedChange: cancel,
			});

			await userEvent.click(getSwitch());
			flushSync();

			expect(set).toHaveBeenCalledTimes(0);
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput().checked).toBe(false);
		});

		it("keeps the hidden input in sync when a function-binding setter declines", async () => {
			const set = vi.fn();
			await render(SwitchRootFunctionBound, { get: () => false, set, style: SIZED });

			await userEvent.click(getSwitch());
			flushSync();

			expect(set).toHaveBeenCalledWith(true);
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput().checked).toBe(false);
		});

		it("runs onCheckedChange before the bound setter", async () => {
			const calls: string[] = [];
			let value = false;
			await render(SwitchRootFunctionBound, {
				get: () => value,
				set: (next: boolean) => {
					calls.push("setter");
					value = next;
				},
				style: SIZED,
				onCheckedChange: () => calls.push("onCheckedChange"),
			});

			await userEvent.click(getSwitch());

			expect(calls).toEqual(["onCheckedChange", "setter"]);
		});
	});

	it("calls onCheckedChange with the reason `none`", async () => {
		const onCheckedChange = vi.fn();
		await render(SwitchRoot, { onCheckedChange });

		(getSwitch().element() as HTMLElement).click();

		expect(onCheckedChange).toHaveBeenCalledTimes(1);
		expect(onCheckedChange.mock.calls[0][1].reason).toBe("none");
	});

	it("lets onclick skip the switch's handler with preventSohedraHandler()", async () => {
		await render(SwitchRootPreventHandler);

		await userEvent.click(getSwitch());

		await expect.element(getSwitch()).toHaveAttribute("data-prevented", "true");
		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
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
			const { container } = await render(SwitchRoot, { style: SIZED });
			const events = listen(container);

			await userEvent.click(getSwitch());

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			expect(events).toEqual([
				{ type: "input", target: hiddenInput(), bubbles: true },
				{ type: "change", target: hiddenInput(), bubbles: true },
			]);
		});

		it("fires neither when onCheckedChange cancels", async () => {
			const { container } = await render(SwitchRoot, { style: SIZED, onCheckedChange: cancel });
			const events = listen(container);

			await userEvent.click(getSwitch());
			flushSync();

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(events).toEqual([]);
		});

		it("fires neither when a function-binding setter declines", async () => {
			const set = vi.fn();
			const { container } = await render(SwitchRootFunctionBound, {
				get: () => false,
				set,
				style: SIZED,
			});
			const events = listen(container);

			await userEvent.click(getSwitch());
			flushSync();

			expect(set).toHaveBeenCalledWith(true);
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(events).toEqual([]);
		});
	});

	it("shares its state with parts through SwitchRootContext", async () => {
		const { getByTestId } = await render(SwitchRootWithContextValue, { style: SIZED });
		await expect.element(getByTestId("context")).toHaveTextContent("unchecked");

		await userEvent.click(getSwitch());

		await expect.element(getByTestId("context")).toHaveTextContent("checked");
		await expect.element(getByTestId("context")).not.toHaveTextContent("unchecked");
	});

	it("throws SwitchRootContext's message outside Switch.Root", async () => {
		await expect(render(SwitchRootContextValue)).rejects.toThrow(
			"SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.",
		);
	});

	it("renders the uncheckedValue input only while unchecked", async () => {
		const { container } = await render(SwitchRoot, {
			name: "switch-name",
			uncheckedValue: "off",
			style: SIZED,
		});
		const uncheckedInput = () => container.querySelector('input[type="hidden"]');
		expect(uncheckedInput()).toHaveAttribute("name", "switch-name");
		expect(uncheckedInput()).toHaveAttribute("value", "off");

		await userEvent.click(getSwitch());

		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
		expect(uncheckedInput()).toBeNull();
	});

	it("renders no text beside the switch", async () => {
		const { container } = await render(SwitchRoot, { name: "switch-name", uncheckedValue: "off" });
		expect(container.textContent).toBe("");
	});

	it("toggles exactly once when the switch itself is clicked inside a wrapping <label>", async () => {
		const onCheckedChange = vi.fn();
		await render(SwitchRootInLabel, { onCheckedChange, style: SIZED });

		await userEvent.click(getSwitch());

		await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
		expect(hiddenInput().checked).toBe(true);
		expect(onCheckedChange).toHaveBeenCalledTimes(1);
	});

	// A label mounted later is observed.
	it("names the switch by a native label mounted after it, and drops a removed one", async () => {
		const { rerender } = await render(SwitchRootWithLabels, { labels: [], id: "late" });
		await expect.element(getSwitch()).not.toHaveAttribute("aria-labelledby");

		await rerender({ labels: [{ for: "late", text: "Late label" }], id: "late" });
		await expect.element(getSwitch()).toHaveAccessibleName("Late label");

		await rerender({ labels: [], id: "late" });
		await expect.element(getSwitch()).not.toHaveAttribute("aria-labelledby");
	});
});
