// The suite every checked control runs (Switch, Checkbox, Radio): a script's click on the hidden
// input, `bind:checked`, the change reason, the unchecked value, and a form reset.
import { type Component, flushSync, mount, unmount } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import { hiddenInput } from "../kit/kit-form.js";

/**
 * Describes a checked control to the suite: its role, its hidden input, and the fixtures the
 * suite renders it with. Each fixture passes the props it is given on to the control.
 */
export type CheckedControlSetup = {
	/** The role the control's visible element has. */
	role: "switch" | "checkbox" | "radio";
	/** The type of the hidden input the control renders. */
	inputType: "checkbox" | "radio";
	/**
	 * The control alone, sized so a real pointer can press it. Nothing else on the page has its
	 * role or renders text.
	 */
	demo: Component<Record<string, unknown>>;
	/**
	 * The control with `bind:checked` to the parent's `$state`, which starts at `initial` and is
	 * shown in `data-testid="bound"`.
	 */
	bound: Component<Record<string, unknown>>;
	/**
	 * The control in a `<form>` with a "Submit" and a "Reset" button. With `binding: "state"`,
	 * `checked` is bound to a `$state` that starts at `initial` and is shown, outside the form, in
	 * `data-testid="bound"`.
	 */
	inForm: Component<Record<string, unknown>>;
};

/** Runs the checked-control suite for the control `name` (`"Switch.Root"`). */
export function describeCheckedControl(name: string, setup: () => CheckedControlSetup): void {
	describe(`${name} checked control`, () => {
		describe("a script's click on the hidden input", () => {
			// No pointer reaches the visually hidden input: a native label or a script clicks it.
			function clickHiddenInput(container: HTMLElement) {
				hiddenInput(container, setup().inputType).dispatchEvent(
					new MouseEvent("click", { bubbles: true }),
				);
			}

			it.each([["disabled"], ["readOnly"]] as const)("changes nothing when %s", async (key) => {
				const onCheckedChange = vi.fn();
				const screen = await render(setup().demo, { [key]: true, onCheckedChange });
				const root = screen.getByRole(setup().role);

				clickHiddenInput(screen.container);

				expect(onCheckedChange).not.toHaveBeenCalled();
				await expect.element(root).toHaveAttribute("aria-checked", "false");
				// The event is not cancelable, so the browser's toggle is not undone by
				// `preventDefault()`: the input is set back to the control's value.
				expect(hiddenInput(screen.container, setup().inputType).checked).toBe(false);
			});

			it("still toggles when it is neither", async () => {
				const onCheckedChange = vi.fn();
				const screen = await render(setup().demo, { onCheckedChange });

				clickHiddenInput(screen.container);

				expect(onCheckedChange).toHaveBeenCalledTimes(1);
				await expect
					.element(screen.getByRole(setup().role))
					.toHaveAttribute("aria-checked", "true");
				expect(hiddenInput(screen.container, setup().inputType).checked).toBe(true);
			});
		});

		describe("bind:checked", () => {
			it("writes the new value through bind:checked", async () => {
				const screen = await render(setup().bound, { initial: false });
				await expect.element(screen.getByTestId("bound")).toHaveTextContent("false");

				await userEvent.click(screen.getByRole(setup().role));

				await expect.element(screen.getByTestId("bound")).toHaveTextContent("true");
				await expect
					.element(screen.getByRole(setup().role))
					.toHaveAttribute("aria-checked", "true");
			});

			it("writes defaultChecked to a bound undefined value", async () => {
				const screen = await render(setup().bound, { defaultChecked: true });
				await expect.element(screen.getByTestId("bound")).toHaveTextContent("true");
				await expect
					.element(screen.getByRole(setup().role))
					.toHaveAttribute("aria-checked", "true");
			});
		});

		it("calls onCheckedChange with the reason `none`", async () => {
			const onCheckedChange = vi.fn();
			const screen = await render(setup().demo, { onCheckedChange });

			await userEvent.click(screen.getByRole(setup().role));

			expect(onCheckedChange).toHaveBeenCalledTimes(1);
			expect(onCheckedChange.mock.calls[0][1].reason).toBe("none");
		});

		it("renders the uncheckedValue input only while unchecked", async () => {
			const screen = await render(setup().demo, { name: "switch-name", uncheckedValue: "off" });
			const uncheckedInput = () => screen.container.querySelector('input[type="hidden"]');
			expect(uncheckedInput()).toHaveAttribute("name", "switch-name");
			expect(uncheckedInput()).toHaveAttribute("value", "off");

			await userEvent.click(screen.getByRole(setup().role));

			await expect.element(screen.getByRole(setup().role)).toHaveAttribute("aria-checked", "true");
			expect(uncheckedInput()).toBeNull();
		});

		describe("form reset", () => {
			it("puts the form data back on defaultChecked as soon as the form is reset", async () => {
				const screen = await render(setup().inForm, { defaultChecked: true, name: "test-switch" });
				const form = screen.container.querySelector("form")!;
				await userEvent.click(screen.getByRole(setup().role));
				expect(new FormData(form).get("test-switch")).toBe(null);

				form.reset();

				expect(new FormData(form).get("test-switch")).toBe("on");
			});

			it("writes the reset value through bind:checked", async () => {
				const screen = await render(setup().inForm, {
					binding: "state",
					initial: true,
					defaultChecked: false,
				});
				await expect.element(screen.getByTestId("bound")).toHaveTextContent("true");

				screen.container.querySelector("form")!.reset();

				await expect.element(screen.getByTestId("bound")).toHaveTextContent("false");
				await expect
					.element(screen.getByRole(setup().role))
					.toHaveAttribute("aria-checked", "false");
				expect(hiddenInput(screen.container, setup().inputType).checked).toBe(false);
			});

			// `reset` isn't composed: inside a shadow root it never reaches the document.
			it("resets inside a shadow root", async () => {
				const host = document.body.appendChild(document.createElement("div"));
				const root = host.attachShadow({ mode: "open" });
				const app = mount(setup().inForm, {
					target: root.appendChild(document.createElement("div")),
					props: { name: "test-switch" },
				});
				flushSync();
				try {
					const control = root.querySelector<HTMLElement>(`[role="${setup().role}"]`)!;
					await userEvent.click(page.elementLocator(control));
					await expect
						.element(page.elementLocator(control))
						.toHaveAttribute("aria-checked", "true");

					await userEvent.click(page.elementLocator(root.querySelector('button[type="reset"]')!));

					await expect.poll(() => control.getAttribute("aria-checked")).toBe("false");
				} finally {
					void unmount(app);
					host.remove();
				}
			});
		});
	});
}
