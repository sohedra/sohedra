// Which requests resolve from the app's folder (`svelte` and the packages named in `singleCopy`),
// and which from this package's.

import { describe, expect, it } from "@rstest/core";

import { requestsOf } from "../../../../src/build/plugin/resolve.ts";

describe("requestsOf", () => {
	const requests = requestsOf(["svelte", "zustand", "@acme/state"]);

	it("takes a package's name, and a path into it", () => {
		for (const request of [
			"svelte",
			"svelte/internal/client",
			"zustand",
			"zustand/vanilla",
			"@acme/state",
			"@acme/state/store",
		])
			expect(requests.test(request), request).toBe(true);
	});

	it("takes no other package whose name starts the same, nor a scope without the package", () => {
		for (const request of [
			"svelte-check",
			"svelte-lynx",
			"zustand-persist",
			"@acme",
			"@acme/other",
		])
			expect(requests.test(request), request).toBe(false);
	});

	it("takes a name with characters that mean something in a pattern as that name", () => {
		const odd = requestsOf(["a.b", "c+d"]);
		expect(odd.test("a.b")).toBe(true);
		expect(odd.test("axb")).toBe(false);
		expect(odd.test("c+d/sub")).toBe(true);
		expect(odd.test("ccd")).toBe(false);
	});
});
