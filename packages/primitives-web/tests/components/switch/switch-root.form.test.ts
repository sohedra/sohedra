import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
// Switch.Root in a plain form: the data it submits as its props change, the input event the form
// sees, and a native reset, which restores defaultChecked without onCheckedChange.
import type { Locator } from "vitest/browser";
import { userEvent } from "vitest/browser";

import { hiddenInput } from "../../kit/kit-form.js";
import { nextTask } from "../../kit/kit-frames.js";
import SwitchInForm from "./fixtures/switch-in-form.svelte";

/** The switch in its form, with the form's parts. */
async function setup(props: Record<string, unknown>) {
	const screen = await render(SwitchInForm, props);
	return {
		screen,
		root: screen.getByRole("switch"),
		form: screen.container.querySelector("form")!,
		submit: screen.getByRole("button", { name: "Submit" }),
		reset: screen.getByRole("button", { name: "Reset" }),
		input: () => hiddenInput(screen.container),
	};
}

describe("Switch.Root", () => {
	describe("in a form", () => {
		it("updates submitted data when name or uncheckedValue change after mount", async () => {
			const submitSpy = vi.fn((event: SubmitEvent) =>
				Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement)),
			);
			const { screen, root, submit } = await setup({
				name: "before",
				uncheckedValue: "off",
				onFormSubmit: submitSpy,
			});

			await screen.rerender({ name: "after", uncheckedValue: "no" });
			await userEvent.click(submit);
			expect(submitSpy.mock.results.at(-1)?.value).toEqual({ after: "no" });

			await userEvent.click(root);
			await userEvent.click(submit);
			expect(submitSpy.mock.results.at(-1)?.value).toEqual({ after: "on" });
		});

		it("fires a bubbling input event on the form when the switch changes", async () => {
			const { root, form, input } = await setup({ name: "test-switch" });
			const targets: (EventTarget | null)[] = [];
			form.addEventListener("input", (event) => targets.push(event.target));

			await userEvent.click(root);

			expect(targets).toEqual([input()]);
		});
	});

	describe("on a form reset", () => {
		it.each([
			["form.reset()", (parts: { form: HTMLFormElement }) => parts.form.reset()],
			["a reset button", (parts: { reset: Locator }) => userEvent.click(parts.reset)],
		])("restores defaultChecked on form reset through %s", async (_, reset) => {
			const parts = await setup({ defaultChecked: true });
			const { root, input } = parts;

			await userEvent.click(root);
			await expect.element(root).toHaveAttribute("aria-checked", "false");
			expect(input().checked).toBe(false);

			await reset(parts);

			await expect.element(root).toHaveAttribute("aria-checked", "true");
			await expect.poll(() => input().checked).toBe(true);
		});

		it("resets when the form's own onreset stops propagation", async () => {
			const { root, form, input } = await setup({
				checked: true,
				defaultChecked: false,
				name: "test-switch",
				onFormReset: (event: Event) => event.stopPropagation(),
			});

			form.reset();

			await expect.element(root).toHaveAttribute("aria-checked", "false");
			await expect.poll(() => input().checked).toBe(false);
			expect(new FormData(form).get("test-switch")).toBe(null);
		});

		it("submits the uncheckedValue after a reset from on to off", async () => {
			const submitSpy = vi.fn((event: SubmitEvent) =>
				new FormData(event.currentTarget as HTMLFormElement).getAll("test-switch"),
			);
			const { root, form, submit } = await setup({
				defaultChecked: false,
				name: "test-switch",
				value: "yes",
				uncheckedValue: "no",
				onFormSubmit: submitSpy,
			});
			await userEvent.click(root);
			await expect.element(root).toHaveAttribute("aria-checked", "true");

			form.reset();
			await expect.element(root).toHaveAttribute("aria-checked", "false");

			await userEvent.click(submit);
			expect(submitSpy.mock.results.at(-1)?.value).toEqual(["no"]);
		});

		it("does not call onCheckedChange on reset", async () => {
			const onCheckedChange = vi.fn();
			const { root, form } = await setup({ checked: true, defaultChecked: false, onCheckedChange });

			form.reset();

			await expect.element(root).toHaveAttribute("aria-checked", "false");
			expect(onCheckedChange).toHaveBeenCalledTimes(0);
		});

		it.each([{ disabled: true }, { readOnly: true }])("resets even when %o", async (props) => {
			const { root, form, input } = await setup({ checked: true, defaultChecked: false, ...props });

			form.reset();

			await expect.element(root).toHaveAttribute("aria-checked", "false");
			expect(input().checked).toBe(false);
		});

		// A trusted click on a reset button runs microtasks between the reset event and the browser's
		// reset of the controls, so this guards the switch syncing in a task after the reset.
		it("stays on when the form's onreset cancels a reset-button click", async () => {
			const { root, reset, input } = await setup({
				defaultChecked: false,
				onFormReset: (event: Event) => event.preventDefault(),
			});
			await userEvent.click(root);
			await expect.element(root).toHaveAttribute("aria-checked", "true");

			await userEvent.click(reset);
			// Past the task in which the switch would restore its default.
			await nextTask();

			await expect.element(root).toHaveAttribute("aria-checked", "true");
			expect(input().checked).toBe(true);
		});

		it("does not reset when the reset event is canceled", async () => {
			const { root, form, input } = await setup({ checked: true, defaultChecked: false });
			form.addEventListener("reset", (event) => event.preventDefault());

			form.reset();
			// Past the task in which the switch would restore its default.
			await nextTask();

			await expect.element(root).toHaveAttribute("aria-checked", "true");
			expect(input().checked).toBe(true);
		});

		it("keeps the hidden input in sync when a function-binding setter declines the reset", async () => {
			const set = vi.fn();
			const submitSpy = vi.fn((event: SubmitEvent) =>
				new FormData(event.currentTarget as HTMLFormElement).getAll("test-switch"),
			);
			const { root, reset, submit, input } = await setup({
				binding: "function",
				get: () => true,
				set,
				defaultChecked: false,
				name: "test-switch",
				uncheckedValue: "off",
				onFormSubmit: submitSpy,
			});

			await userEvent.click(reset);
			await expect.poll(() => set).toHaveBeenCalledWith(false);
			// Past the browser's own reset of the controls, in the task the switch restores in.
			await nextTask();

			await expect.element(root).toHaveAttribute("aria-checked", "true");
			expect(input().checked).toBe(true);
			await userEvent.click(submit);
			expect(submitSpy.mock.results.at(-1)?.value).toEqual(["on"]);
		});
	});
});
