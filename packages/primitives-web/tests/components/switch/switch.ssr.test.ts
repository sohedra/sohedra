// What Switch's server HTML leaves out: the props that only feed the parts' state, and the
// properties only the DOM has.
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import SwitchPage from "./fixtures/switch-page.svelte";

describe("Switch server render", () => {
	it("emits no attributes for model props or DOM-only properties", () => {
		const { body } = render(SwitchPage);
		expect(body).not.toMatch(
			/defaultchecked|default-checked|uncheckedvalue|nativebutton|inputref/i,
		);
	});
});
