// What Switch.Root re-runs and tears down: its user's attachment and its listeners across props
// that are re-derived or re-provided equal, its effects on equal props, and a swap for another
// switch with the old one's teardown last.
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import { hiddenInput } from "../../kit/kit-form.js";
import { settle } from "../../kit/kit-frames.js";
import SwitchRootReprovided from "./fixtures/switch-root-reprovided.svelte";
import SwitchRootSwap from "./fixtures/switch-root-swap.svelte";

afterEach(() => {
	vi.restoreAllMocks();
});

// An empty switch has no size, and userEvent only clicks visible elements.
const SIZED = "display: inline-block; width: 16px; height: 16px";

/** Calls to a prototype accessor's setter (or getter) made on `target`. */
function spyOnAccessor<T extends object>(
	proto: T,
	key: keyof T & string,
	kind: "get" | "set",
	target: () => unknown,
) {
	const calls: unknown[] = [];
	const descriptor = Object.getOwnPropertyDescriptor(proto, key)!;
	const original = descriptor[kind]!;
	Object.defineProperty(proto, key, {
		...descriptor,
		[kind](this: unknown, ...args: unknown[]) {
			if (this === target()) {
				calls.push(args[0]);
			}
			return (original as (...a: unknown[]) => unknown).apply(this, args);
		},
	});
	return {
		calls,
		restore: () => Object.defineProperty(proto, key, descriptor),
	};
}

describe("Switch.Root", () => {
	describe.each([false, true])("renderButton=%s", (renderButton) => {
		it("runs a user attachment once across state changes and re-provided props", async () => {
			const attach = vi.fn();
			const screen = await render(SwitchRootReprovided, {
				attach,
				renderButton,
				initial: { disabled: false, required: false, onfocus: () => {}, style: SIZED },
			});
			const root = screen.getByRole("switch");
			expect(attach).toHaveBeenCalledTimes(1);
			expect(attach).toHaveBeenCalledWith(root.element());

			await userEvent.click(root);
			await userEvent.click(root);
			screen.component.setProps({ disabled: false, required: false, onfocus: () => {} });
			flushSync();
			screen.component.setProps({ required: true, onfocus: () => {} });
			flushSync();

			await expect.element(root).toHaveAttribute("aria-required", "true");
			expect(attach).toHaveBeenCalledTimes(1);
		});

		it("does not rebind its listeners when its props are re-derived", async () => {
			const onfocus = vi.fn();
			const screen = await render(SwitchRootReprovided, {
				attach: () => {},
				renderButton,
				initial: { onfocus },
			});
			const root = screen.getByRole("switch").element() as HTMLElement;
			const add = vi.spyOn(root, "addEventListener");
			const remove = vi.spyOn(root, "removeEventListener");

			const latest = vi.fn();
			// Script clicks: a real one would also focus the switch, and the test counts focus calls.
			root.click();
			flushSync();
			screen.component.setProps({ onfocus: latest, readOnly: false });
			flushSync();
			root.click();
			flushSync();

			expect(add).not.toHaveBeenCalled();
			expect(remove).not.toHaveBeenCalled();
			// The stable listener calls the latest handler.
			root.focus();
			expect(latest).toHaveBeenCalledTimes(1);
			expect(onfocus).not.toHaveBeenCalled();
		});
	});

	it("does not re-run its effects when a parent re-provides equal props", async () => {
		let input: HTMLInputElement | null = null;
		const defaultChecked = spyOnAccessor(
			HTMLInputElement.prototype,
			"defaultChecked",
			"set",
			() => input,
		);
		const labels = spyOnAccessor(HTMLInputElement.prototype, "labels", "get", () => input);
		try {
			const screen = await render(SwitchRootReprovided, {
				attach: () => {},
				initial: { defaultChecked: false, disabled: false, "aria-label": undefined },
			});
			input = hiddenInput(screen.container);
			const label = screen.getByText("Label").element();
			await expect.element(screen.getByRole("switch")).toHaveAttribute("aria-labelledby", label.id);

			screen.component.setProps({
				defaultChecked: false,
				disabled: false,
				"aria-label": undefined,
			});
			flushSync();
			screen.component.setProps({ defaultChecked: undefined, disabled: undefined });
			flushSync();
			await settle();

			expect(defaultChecked.calls).toEqual([]);
			expect(labels.calls).toEqual([]);

			screen.component.setProps({ defaultChecked: true });
			flushSync();
			expect(defaultChecked.calls).toEqual([true]);
		} finally {
			defaultChecked.restore();
			labels.restore();
		}
	});

	describe("swapped for another switch", () => {
		it.each([
			{ mode: "if" as const, outro: 0 },
			{ mode: "if" as const, outro: 80 },
			{ mode: "key" as const, outro: 0 },
		])(
			"leaves bind:ref and the form reset to the new switch ($mode, outro $outro)",
			async ({ mode, outro }) => {
				const errors = vi.spyOn(console, "error");
				const screen = await render(SwitchRootSwap, { mode, outro });
				expect(screen.component.getRef()).toBe(screen.getByTestId("a").element());

				screen.component.swap();
				flushSync();
				const b = screen.getByTestId("b");
				expect(screen.component.getRef()).toBe(b.element());

				// Past the old switch's outro, if any: its teardown must not clear the new switch's ref.
				// The outro ends on the browser's animation clock, which a loaded machine stretches.
				await expect.poll(() => screen.container.querySelector('[data-testid="a"]')).toBeNull();
				expect(screen.component.getRef()).toBe(b.element());

				await userEvent.click(b);
				await expect.element(b).toHaveAttribute("aria-checked", "true");
				screen.container.querySelector("form")!.reset();
				await expect.element(b).toHaveAttribute("aria-checked", "false");
				expect(errors).not.toHaveBeenCalled();
			},
		);
	});
});
