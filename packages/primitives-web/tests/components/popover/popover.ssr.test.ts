// The server halves of the Popover hydration tests: the conformance suites of the
// popover-*.test.ts files, and the closed and initially open popovers of popover-trigger.test.ts.
// The Portal resolves its container after mount, so the server renders only what
// sits outside it.

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import { describeServerRender } from "../../conformance/ssr-render.js";
import { popoverArrowConformance } from "./fixtures/popover-arrow-conformance.js";
import { popoverBackdropConformance } from "./fixtures/popover-backdrop-conformance.js";
import { popoverCloseConformance } from "./fixtures/popover-close-conformance.js";
import { popoverDescriptionConformance } from "./fixtures/popover-description-conformance.js";
import { popoverPopupConformance } from "./fixtures/popover-popup-conformance.js";
import { popoverPortalConformance } from "./fixtures/popover-portal-conformance.js";
import PartSsrPopover from "./fixtures/popover-ssr.svelte";
import { popoverTitleConformance } from "./fixtures/popover-title-conformance.js";
import { popoverTriggerConformance } from "./fixtures/popover-trigger-conformance.js";
import { popoverViewportConformance } from "./fixtures/popover-viewport-conformance.js";

describeServerRender("Popover.Trigger", () => popoverTriggerConformance);
describeServerRender("Popover.Popup", () => popoverPopupConformance);
describeServerRender("Popover.Close", () => popoverCloseConformance);
describeServerRender("Popover.Backdrop", () => popoverBackdropConformance);
describeServerRender("Popover.Title", () => popoverTitleConformance);
describeServerRender("Popover.Description", () => popoverDescriptionConformance);
describeServerRender("Popover.Arrow", () => popoverArrowConformance);
describeServerRender("Popover.Portal", () => popoverPortalConformance);
describeServerRender("Popover.Viewport", () => popoverViewportConformance);

/** The elements of `body` as `<tag attr="value" …>` strings, without Svelte's comments. */
function openingTags(body: string) {
	return body.match(/<[a-z][^>]*>/g) ?? [];
}

describe.each([
	{ name: "closed popover", file: "popover-closed.html", defaultOpen: false },
	{ name: "defaultOpen popover", file: "popover-default-open.html", defaultOpen: true },
])("$name server render", ({ file, defaultOpen }) => {
	it("matches the HTML fixture the browser hydrates", async () => {
		const { body } = render(PartSsrPopover, { props: { defaultOpen } });
		const path = decodeURIComponent(new URL(`./__ssr__/${file}`, import.meta.url).pathname);
		await expect(body).toMatchFileSnapshot(path);
	});

	it("renders only the trigger, closed", () => {
		const { body } = render(PartSsrPopover, { props: { defaultOpen } });
		const tags = openingTags(body);
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
