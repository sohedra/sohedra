// The slice 1 "must prove" claims about Svelte that the docs don't settle, and the regressions
// the previous library had: attachments and listeners that churn, effects that re-run on equal
// props, and registrations torn down in the wrong order on a component swap.
import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createRenderer,
	fireEvent,
	screen,
	flushAfterMicrotask,
	waitFor,
} from "../../shim/index.js";
import SwitchRootReprovided from "./fixtures/switch-root-reprovided.svelte";
import SwitchRootSwap from "./fixtures/switch-root-swap.svelte";

afterEach(() => {
	vi.restoreAllMocks();
});

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

describe("Switch.Root reactivity", () => {
	const { render } = createRenderer();

	describe.each([false, true])("renderButton=%s", (renderButton) => {
		it("runs a user attachment once across state changes and re-provided props", async () => {
			const attach = vi.fn();
			const { component } = await render(SwitchRootReprovided, {
				attach,
				renderButton,
				initial: { disabled: false, required: false, onfocus: () => {} },
			});
			const switchElement = screen.getByRole("switch");
			expect(attach).toHaveBeenCalledTimes(1);
			expect(attach).toHaveBeenCalledWith(switchElement);

			fireEvent.click(switchElement);
			fireEvent.click(switchElement);
			component.setProps({ disabled: false, required: false, onfocus: () => {} });
			flushSync();
			component.setProps({ required: true, onfocus: () => {} });
			flushSync();

			expect(switchElement).toHaveAttribute("aria-required", "true");
			expect(attach).toHaveBeenCalledTimes(1);
		});

		it("does not rebind its listeners when its props are re-derived", async () => {
			const onfocus = vi.fn();
			const { component } = await render(SwitchRootReprovided, {
				attach: () => {},
				renderButton,
				initial: { onfocus },
			});
			const switchElement = screen.getByRole("switch");
			const add = vi.spyOn(switchElement, "addEventListener");
			const remove = vi.spyOn(switchElement, "removeEventListener");

			const latest = vi.fn();
			fireEvent.click(switchElement);
			component.setProps({ onfocus: latest, readOnly: false });
			flushSync();
			fireEvent.click(switchElement);

			expect(add).not.toHaveBeenCalled();
			expect(remove).not.toHaveBeenCalled();
			// The stable listener calls the latest handler.
			switchElement.focus();
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
			const { component } = await render(SwitchRootReprovided, {
				attach: () => {},
				initial: { defaultChecked: false, disabled: false, "aria-label": undefined },
			});
			input = screen.getByRole<HTMLInputElement>("checkbox", { hidden: true });
			const label = screen.getByText("Label");
			expect(screen.getByRole("switch")).toHaveAttribute("aria-labelledby", label.id);

			component.setProps({ defaultChecked: false, disabled: false, "aria-label": undefined });
			flushSync();
			component.setProps({ defaultChecked: undefined, disabled: undefined });
			flushSync();
			await flushAfterMicrotask();

			expect(defaultChecked.calls).toEqual([]);
			expect(labels.calls).toEqual([]);

			component.setProps({ defaultChecked: true });
			flushSync();
			expect(defaultChecked.calls).toEqual([true]);
		} finally {
			defaultChecked.restore();
			labels.restore();
		}
	});

	describe("component swap", () => {
		it.each([
			{ mode: "if" as const, outro: 0 },
			{ mode: "if" as const, outro: 80 },
			{ mode: "key" as const, outro: 0 },
		])(
			"leaves bind:ref and the form reset to the new switch ($mode, outro $outro)",
			async ({ mode, outro }) => {
				const errors = vi.spyOn(console, "error");
				const { component } = await render(SwitchRootSwap, { mode, outro });
				expect(component.getRef()).toBe(screen.getByTestId("a"));

				component.swap();
				flushSync();
				const b = screen.getByTestId("b");
				expect(component.getRef()).toBe(b);

				// Past the old switch's outro, if any: its teardown must not clear the new switch's ref.
				// The outro ends on the browser's animation clock, which a loaded machine stretches.
				await waitFor(() => {
					expect(screen.queryByTestId("a")).toBeNull();
				});
				expect(component.getRef()).toBe(b);

				fireEvent.click(b);
				expect(b).toHaveAttribute("aria-checked", "true");
				document.querySelector("form")!.reset();
				await new Promise((resolve) => setTimeout(resolve, 0));
				expect(b).toHaveAttribute("aria-checked", "false");
				expect(errors).not.toHaveBeenCalled();
			},
		);
	});
});
