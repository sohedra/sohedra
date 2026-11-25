// What Svelte's server runtime gets for `devalue` on the main thread: a stand-in whose `uneval`
// throws, naming `hydratable`, should anything ever reach it.

import { describe, expect, it } from "@rstest/core";

import { uneval } from "../../../../src/svelte/runtime/devalue.ts";

describe("devalue's stand-in", () => {
	it("throws, naming hydratable, when Svelte serializes with it", () => {
		expect(() => uneval({ a: 1 })).toThrow(
			expect.objectContaining({ code: "hydratable_not_on_lynx" }),
		);
		expect(() => uneval(1)).toThrow(/hydratable/);
	});
});
