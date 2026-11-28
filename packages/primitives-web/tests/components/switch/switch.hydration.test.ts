// Switch's server HTML and its hydration: what the server renders for each part, the accessibility
// tree before and after hydration, and hydration without a mismatch.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { ssrHydration } from "../../conformance/ssr-hydration.js";
import { hydrateOnPage, renderOnServer, serverHtmlOnPage } from "../../kit/kit-server.js";
import SwitchPage from "./fixtures/switch-page.svelte";

const PAGE = new URL("./fixtures/switch-page.svelte", import.meta.url);

/**
 * The page's server HTML on the page, not hydrated. Its first switch's parts are found by place,
 * not by role: the label "first", the root after it, the thumb in the root, the hidden input after.
 */
async function serverPage(props: Record<string, unknown> = {}) {
	const container = serverHtmlOnPage(await renderOnServer(PAGE, props));
	const label = container.querySelector<HTMLLabelElement>('label[for="first"]')!;
	const root = label.nextElementSibling as HTMLElement;
	return {
		container,
		label,
		root,
		thumb: root.firstElementChild as HTMLElement,
		input: container.querySelector<HTMLInputElement>('input[type="checkbox"]')!,
	};
}

describe("Switch server HTML", () => {
	it("renders the root as an unchecked switch, with no state it was not given", async () => {
		const { root, thumb } = await serverPage();

		expect(root.tagName).toBe("SPAN");
		expect(root).toHaveAttribute("role", "switch");
		expect(root).toHaveAttribute("aria-checked", "false");
		expect(root).toHaveAttribute("tabindex", "0");
		expect(root).toHaveAttribute("data-unchecked", "");
		expect(root).not.toHaveAttribute("data-checked");
		expect(root).not.toHaveAttribute("aria-required");
		expect(root).not.toHaveAttribute("aria-readonly");
		expect(root).not.toHaveAttribute("aria-disabled");
		expect(thumb).toHaveAttribute("data-unchecked", "");
		expect(thumb).not.toHaveAttribute("data-checked");
	});

	it("renders aria-required and aria-readonly when they are set", async () => {
		const { root, thumb } = await serverPage({ required: true, readOnly: true });

		expect(root).toHaveAttribute("aria-required", "true");
		expect(root).toHaveAttribute("aria-readonly", "true");
		expect(root).toHaveAttribute("data-required", "");
		expect(root).toHaveAttribute("data-readonly", "");
		expect(thumb).toHaveAttribute("data-required", "");
		expect(thumb).toHaveAttribute("data-readonly", "");
	});

	it("renders the checked state on the root, the thumb and the hidden input", async () => {
		const { root, thumb, input } = await serverPage({ defaultChecked: true });

		expect(root).toHaveAttribute("aria-checked", "true");
		expect(root).toHaveAttribute("data-checked", "");
		expect(root).not.toHaveAttribute("data-unchecked");
		expect(thumb).toHaveAttribute("data-checked", "");
		expect(input).toHaveAttribute("checked");
	});

	it("renders disabled on the root, the thumb and the hidden input", async () => {
		const { root, thumb, input } = await serverPage({ disabled: true });

		expect(root).toHaveAttribute("aria-disabled", "true");
		expect(root).toHaveAttribute("data-disabled", "");
		expect(thumb).toHaveAttribute("data-disabled", "");
		expect(input).toHaveAttribute("disabled");
	});

	it("renders the hidden input with the id the label points at, and the root with its own", async () => {
		const { label, root, input } = await serverPage();

		expect(label).toHaveAttribute("for", "first");
		expect(input).toHaveAttribute("id", "first");
		expect(input).toHaveAttribute("name", "first");
		expect(input).toHaveAttribute("aria-hidden", "true");
		expect(input).toHaveAttribute("tabindex", "-1");
		expect(root.id).not.toBe("");
		expect(root.id).not.toBe(input.id);
	});
});

describe("Switch hydration", () => {
	it("hydrates without a mismatch, and names each switch once hydrated", async () => {
		const { container } = await serverPage();
		const tree = page.elementLocator(container);
		await expect.element(tree).toMatchAriaInlineSnapshot(`
			- text: first
			- switch
			- text: second
			- switch
			- text: third
			- switch
			- switch
			- text: Notifications
		`);

		hydrateOnPage(container, SwitchPage, {});

		await expect.element(tree).toMatchAriaInlineSnapshot(`
			- text: first
			- switch "first"
			- text: second
			- switch "second"
			- text: third
			- switch "third"
			- switch "Notifications"
			- text: Notifications
		`);
	});

	it("keeps ids unique and labels scoped across several hydrated switches", async () => {
		const html = await renderOnServer(PAGE);
		const names = ["first", "second", "third"];
		const inputs = (container: HTMLElement) =>
			names.map((name) => container.querySelector<HTMLInputElement>(`input[id="${name}"]`)!);

		const { before, after } = ssrHydration(SwitchPage, {}, html, (container) => {
			const all = inputs(container);
			expect(all.every(Boolean)).toBe(true);
			for (const [index, name] of names.entries()) {
				container.querySelector<HTMLLabelElement>(`label[for="${name}"]`)!.click();
				flushSync();
				// Only the clicked label's switch is on, and the earlier ones stay as they were.
				expect(all.map((input) => input.checked)).toEqual(names.map((_, i) => i <= index));
				const roots = container.querySelectorAll('[role="switch"]');
				expect(Array.from(roots, (root) => root.getAttribute("aria-checked"))).toEqual([
					...names.map((_, i) => String(i <= index)),
					"false",
				]);
			}
		});

		const ids = after.map((element) => element.id).filter(Boolean);
		// The inputs, plus whatever ids the switches generate for their labels.
		expect(ids).toEqual(expect.arrayContaining(names));
		expect(ids.length).toBeGreaterThanOrEqual(4);
		expect(new Set(ids).size).toBe(ids.length);
		// Hydration keeps the server's ids. (It adds ids to the labels, which the switches use to name
		// themselves, so the two snapshots aren't equal.)
		expect(after.map((element) => element.id)).toEqual(
			expect.arrayContaining(before.map((element) => element.id).filter(Boolean)),
		);
	});
});
