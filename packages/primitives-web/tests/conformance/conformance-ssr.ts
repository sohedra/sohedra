// `describeServerRender`: writes a part's server HTML to `tests/conformance/__ssr__/` in the ssr
// project, for the conformance hydration case of a setup without `module`. It exists for the
// `__ssr__` files of tests not yet rewritten, and goes with the last such file.
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import ConformanceHarness from "./conformance-harness.svelte";
import { serverRenderProps, ssrFileName, type ConformanceSetup } from "./conformance-setup.js";

/**
 * Renders a part on the server and keeps the HTML in `tests/conformance/__ssr__/` (see `ssrFileName`),
 * where `describeConformance` picks it up to hydrate. Use the same `name` and `setup` for both. A
 * setup with `module` needs neither: its hydration case has the server render the part.
 * A missing file is written on a local run; CI fails instead, so commit the file.
 */
export function describeServerRender<State>(name: string, setup: () => ConformanceSetup<State>) {
	describe(`${name} server render`, () => {
		it("matches the HTML fixture the browser hydrates", async () => {
			const { body } = render(ConformanceHarness, { props: serverRenderProps(setup()) });
			const file = decodeURIComponent(
				new URL(`./__ssr__/${ssrFileName(name)}`, import.meta.url).pathname,
			);
			await expect(body).toMatchFileSnapshot(file);
		});
	});
}
