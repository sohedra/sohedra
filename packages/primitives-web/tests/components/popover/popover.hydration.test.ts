// Popover's server HTML and its hydration: the trigger the server renders, the accessibility tree
// before and after hydration, and hydration without a mismatch, closed or starting open.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
	hydrateOnPage,
	renderOnServer,
	serverHtmlOnPage,
	ssrHydration,
} from "../../kit/kit-server.js";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverPage from "./fixtures/popover-page.svelte";

const PAGE = new URL("./fixtures/popover-page.svelte", import.meta.url);
const DEMO = new URL("./fixtures/popover-demo.svelte", import.meta.url);

/** The demo with a Title and a Description, its trigger found by test id in the server HTML. */
const DEMO_PROPS = {
	triggerProps: { "data-testid": "trigger" },
	title: "Title",
	description: "Description",
};

/** The page's server HTML on the page, not hydrated, and its trigger. */
async function serverPage(props: Record<string, unknown> = {}) {
	const container = serverHtmlOnPage(await renderOnServer(PAGE, props));
	return {
		container,
		trigger: container.querySelector<HTMLElement>('[data-testid="trigger"]')!,
	};
}

describe("Popover server HTML", () => {
	it("renders the trigger closed, naming the popup it opens, with no popup", async () => {
		const { container, trigger } = await serverPage();

		expect(trigger.tagName).toBe("BUTTON");
		expect(trigger).toHaveAttribute("type", "button");
		expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).not.toHaveAttribute("aria-controls");
		expect(trigger).not.toHaveAttribute("data-popup-open");
		expect(container.querySelector("[data-sohedra-portal]")).toBe(null);
		expect(container.querySelector('[role="dialog"]')).toBe(null);
	});

	it("renders a popover that starts open as a closed trigger too", async () => {
		const { container, trigger } = await serverPage({ defaultOpen: true });

		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).not.toHaveAttribute("data-popup-open");
		expect(container.querySelector("[data-sohedra-portal]")).toBe(null);
	});
});

describe("Popover hydration", () => {
	it("hydrates without a mismatch, and opens from the hydrated trigger", async () => {
		const { container } = await serverPage();
		const tree = page.elementLocator(container);
		await expect.element(tree).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications"
		`);

		hydrateOnPage(container, PopoverPage, {});

		await expect.element(tree).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications"
		`);
		await userEvent.click(page.getByRole("button", { name: "Notifications" }));
		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
	});

	it("hydrates a popover that starts open, then shows its popup", async () => {
		const { container } = await serverPage({ defaultOpen: true });

		hydrateOnPage(container, PopoverPage, { defaultOpen: true });

		await expect.element(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
		await expect.element(page.elementLocator(document.body)).toMatchAriaInlineSnapshot(`
			- main:
			  - heading "Inbox" [level=1]
			  - button "Notifications" [expanded]
			  - dialog "Notifications":
			    - heading "Notifications" [level=2]
			    - paragraph: You are all caught up.
			    - button "Dismiss"
		`);
	});

	// Sohedra: the server renders a popover's trigger only (its Portal renders after mount), and
	// hydration picks the popover up from there. The checks run inside `ssrHydration`, before it
	// unmounts, so the trigger is pressed by a script click there.
	it("hydrates a closed popover's trigger without warnings and opens it", async () => {
		const html = await renderOnServer(DEMO, DEMO_PROPS);
		let trigger: HTMLElement | null = null;
		const { before, after } = ssrHydration(PopoverDemo, DEMO_PROPS, html, (container) => {
			trigger = container.querySelector("[data-testid=trigger]");
			expect(trigger).toHaveAttribute("aria-expanded", "false");
			expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
			expect(trigger).not.toHaveAttribute("aria-controls");
			expect(document.querySelector("[data-sohedra-portal]")).toBe(null);
			trigger!.click();
			flushSync();
			expect(trigger).toHaveAttribute("aria-expanded", "true");
			expect(page.getByRole("dialog").element()).toBeInTheDocument();
			expect(trigger).toHaveAttribute("aria-controls", page.getByRole("dialog").element().id);
		});
		expect(before.map(({ tag }) => tag)).toEqual(["button"]);
		expect(after).toEqual(before);
	});

	it("hydrates a defaultOpen popover without warnings, then shows the popup", async () => {
		const props = { ...DEMO_PROPS, rootProps: { defaultOpen: true } };
		const html = await renderOnServer(DEMO, props);
		let dialog: HTMLElement | null = null;
		const { before } = ssrHydration(PopoverDemo, props, html, (container) => {
			const trigger = container.querySelector("[data-testid=trigger]");
			dialog = page.getByRole("dialog").element() as HTMLElement;
			expect(dialog.closest("[data-sohedra-portal]")?.parentElement).toBe(document.body);
			expect(dialog).toHaveAttribute("data-open");
			expect(dialog).toHaveAttribute("aria-labelledby", page.getByText("Title").element().id);
			expect(dialog).toHaveAttribute(
				"aria-describedby",
				page.getByText("Description").element().id,
			);
			expect(trigger).toHaveAttribute("aria-expanded", "true");
			expect(trigger).toHaveAttribute("aria-controls", dialog.id);
		});
		expect(before.map(({ tag }) => tag)).toEqual(["button"]);
		expect(before[0]!.data).not.toHaveProperty("data-popup-open");
		expect(dialog).not.toBe(null);
	});
});
