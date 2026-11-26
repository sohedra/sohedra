import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import { describeServerRender } from "../../conformance/ssr-render.js";
import SeveralSwitches from "./fixtures/several-switches.svelte";
import { switchRootConformance } from "./fixtures/switch-root-conformance.js";
import { switchThumbConformance } from "./fixtures/switch-thumb-conformance.js";

// The server halves of the hydration tests in switch-root.test.ts and switch-thumb.test.ts.
describeServerRender("Switch.Root", () => switchRootConformance);
describeServerRender("Switch.Thumb", () => switchThumbConformance);

describe("several switches server render", () => {
	it("matches the HTML fixture the browser hydrates", async () => {
		const { body } = render(SeveralSwitches);
		const file = decodeURIComponent(
			new URL("./__ssr__/several-switches.html", import.meta.url).pathname,
		);
		await expect(body).toMatchFileSnapshot(file);
	});

	it("emits no attributes for model props or DOM-only properties", () => {
		const { body } = render(SeveralSwitches);
		expect(body).not.toMatch(
			/defaultchecked|default-checked|uncheckedvalue|nativebutton|inputref/i,
		);
	});
});
