// What Popover's server HTML holds: the trigger only, closed, whether or not the popover starts
// open, since the Portal resolves its container after mount.
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import PopoverPage from "./fixtures/popover-page.svelte";

/** The page's elements as `<tag attr="value" …>` strings, its own landmark and heading aside. */
function popoverTags(body: string) {
	return (body.match(/<[a-z][^>]*>/g) ?? []).filter((tag) => !/^<(main|h1)\b/.test(tag));
}

describe.each([
	{ name: "closed popover", defaultOpen: false },
	{ name: "defaultOpen popover", defaultOpen: true },
])("$name server render", ({ defaultOpen }) => {
	it("renders only the trigger, closed", () => {
		const { body } = render(PopoverPage, { props: { defaultOpen } });
		const tags = popoverTags(body);
		expect(tags).toHaveLength(1);
		const trigger = tags[0]!;
		expect(trigger).toMatch(/^<button /);
		expect(trigger).toContain('data-testid="trigger"');
		expect(trigger).toContain('type="button"');
		expect(trigger).toContain('aria-haspopup="dialog"');
		expect(trigger).toContain('aria-expanded="false"');
		expect(trigger).not.toContain("aria-controls");
		expect(trigger).not.toContain("data-popup-open");
		expect(body).not.toContain("data-sohedra-portal");
		expect(body).not.toContain('role="dialog"');
	});
});
