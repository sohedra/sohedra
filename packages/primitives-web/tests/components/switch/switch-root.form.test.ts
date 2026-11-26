import { flushSync, mount, unmount } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import FormFixture from "./fixtures/switch-in-form.svelte";

// An empty switch has no size, and userEvent only clicks visible elements.
const SIZED = "display: inline-block; width: 16px; height: 16px";

function getSwitch() {
	return page.getByRole("switch");
}

function submitButton() {
	return page.getByRole("button", { name: "Submit" });
}

function hiddenInput() {
	return document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-hidden="true"]')!;
}

function getForm() {
	return document.querySelector("form")!;
}

// Sohedra form behaviour beyond the Form cases in switch-root.test.ts, and the form reset: a native
// reset restores defaultChecked without onCheckedChange.
describe("Switch.Root in a form", () => {
	describe("submission", () => {
		it("updates submitted data when name or uncheckedValue change after mount", async () => {
			const submitSpy = vi.fn((event: SubmitEvent) =>
				Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement)),
			);
			const { rerender } = await render(FormFixture, {
				name: "before",
				uncheckedValue: "off",
				style: SIZED,
				onFormSubmit: submitSpy,
			});

			await rerender({ name: "after", uncheckedValue: "no" });
			await userEvent.click(submitButton());
			expect(submitSpy.mock.results.at(-1)?.value).toEqual({ after: "no" });

			await userEvent.click(getSwitch());
			await userEvent.click(submitButton());
			expect(submitSpy.mock.results.at(-1)?.value).toEqual({ after: "on" });
		});

		it("fires a bubbling input event on the form when the switch changes", async () => {
			await render(FormFixture, { name: "test-switch", style: SIZED });
			const targets: (EventTarget | null)[] = [];
			getForm().addEventListener("input", (event) => targets.push(event.target));

			await userEvent.click(getSwitch());

			expect(targets).toEqual([hiddenInput()]);
		});
	});

	describe("reset", () => {
		it.each([
			["form.reset()", () => getForm().reset()],
			["a reset button", () => userEvent.click(page.getByRole("button", { name: "Reset" }))],
		])("restores defaultChecked on form reset through %s", async (_, reset) => {
			await render(FormFixture, { defaultChecked: true, style: SIZED });

			await userEvent.click(getSwitch());
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput().checked).toBe(false);

			await reset();

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			await expect.poll(() => hiddenInput().checked).toBe(true);
		});

		it("puts the form data back on defaultChecked as soon as the form is reset", async () => {
			await render(FormFixture, { defaultChecked: true, name: "test-switch", style: SIZED });
			await userEvent.click(getSwitch());
			expect(new FormData(getForm()).get("test-switch")).toBe(null);

			getForm().reset();

			expect(new FormData(getForm()).get("test-switch")).toBe("on");
		});

		it("resets when the form's own onreset stops propagation", async () => {
			await render(FormFixture, {
				checked: true,
				defaultChecked: false,
				name: "test-switch",
				onFormReset: (event: Event) => event.stopPropagation(),
			});

			getForm().reset();

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			await expect.poll(() => hiddenInput().checked).toBe(false);
			expect(new FormData(getForm()).get("test-switch")).toBe(null);
		});

		it("submits the uncheckedValue after a reset from on to off", async () => {
			const submitSpy = vi.fn((event: SubmitEvent) =>
				new FormData(event.currentTarget as HTMLFormElement).getAll("test-switch"),
			);
			await render(FormFixture, {
				defaultChecked: false,
				name: "test-switch",
				value: "yes",
				uncheckedValue: "no",
				onFormSubmit: submitSpy,
				style: SIZED,
			});
			await userEvent.click(getSwitch());
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");

			getForm().reset();
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			await new Promise((resolve) => setTimeout(resolve, 0));

			await userEvent.click(submitButton());
			expect(submitSpy.mock.results.at(-1)?.value).toEqual(["no"]);
		});

		it("writes the reset value through bind:checked", async () => {
			const { getByTestId } = await render(FormFixture, {
				binding: "state",
				initial: true,
				defaultChecked: false,
			});
			await expect.element(getByTestId("bound")).toHaveTextContent("true");

			getForm().reset();

			await expect.element(getByTestId("bound")).toHaveTextContent("false");
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput().checked).toBe(false);
		});

		it("does not call onCheckedChange on reset", async () => {
			const onCheckedChange = vi.fn();
			await render(FormFixture, { checked: true, defaultChecked: false, onCheckedChange });

			getForm().reset();

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(onCheckedChange).toHaveBeenCalledTimes(0);
		});

		it.each([{ disabled: true }, { readOnly: true }])("resets even when %o", async (props) => {
			await render(FormFixture, { checked: true, defaultChecked: false, ...props });

			getForm().reset();

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "false");
			expect(hiddenInput().checked).toBe(false);
		});

		// A trusted click on a reset button runs microtasks between the reset event and the browser's
		// reset of the controls, so this guards the switch syncing in a task after the reset.
		it("stays on when the form's onreset cancels a reset-button click", async () => {
			await render(FormFixture, {
				defaultChecked: false,
				style: SIZED,
				onFormReset: (event: Event) => event.preventDefault(),
			});
			await userEvent.click(getSwitch());
			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");

			await userEvent.click(page.getByRole("button", { name: "Reset" }));
			await new Promise((resolve) => setTimeout(resolve, 0));

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput().checked).toBe(true);
		});

		it("does not reset when the reset event is canceled", async () => {
			await render(FormFixture, { checked: true, defaultChecked: false });
			getForm().addEventListener("reset", (event) => event.preventDefault());

			getForm().reset();
			await new Promise((resolve) => setTimeout(resolve, 0));

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput().checked).toBe(true);
		});

		it("keeps the hidden input in sync when a function-binding setter declines the reset", async () => {
			const set = vi.fn();
			const submitSpy = vi.fn((event: SubmitEvent) =>
				new FormData(event.currentTarget as HTMLFormElement).getAll("test-switch"),
			);
			await render(FormFixture, {
				binding: "function",
				get: () => true,
				set,
				defaultChecked: false,
				name: "test-switch",
				uncheckedValue: "off",
				onFormSubmit: submitSpy,
			});

			await userEvent.click(page.getByRole("button", { name: "Reset" }));
			await expect.poll(() => set).toHaveBeenCalledWith(false);
			// Past the browser's own reset of the controls.
			await new Promise((resolve) => setTimeout(resolve, 0));

			await expect.element(getSwitch()).toHaveAttribute("aria-checked", "true");
			expect(hiddenInput().checked).toBe(true);
			await userEvent.click(submitButton());
			expect(submitSpy.mock.results.at(-1)?.value).toEqual(["on"]);
		});
	});

	// `reset` isn't composed: inside a shadow root it never reaches the document.
	it("resets inside a shadow root", async () => {
		const host = document.body.appendChild(document.createElement("div"));
		const root = host.attachShadow({ mode: "open" });
		const app = mount(FormFixture, {
			target: root.appendChild(document.createElement("div")),
			props: { name: "test-switch" },
		});
		flushSync();
		try {
			const switchElement = root.querySelector<HTMLElement>('[role="switch"]')!;
			switchElement.click();
			flushSync();
			expect(switchElement).toHaveAttribute("aria-checked", "true");

			root.querySelector<HTMLButtonElement>('button[type="reset"]')!.click();

			await expect.poll(() => switchElement.getAttribute("aria-checked")).toBe("false");
		} finally {
			unmount(app);
			host.remove();
		}
	});
});
