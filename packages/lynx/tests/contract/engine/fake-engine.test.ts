// The engine behavior spec, run on the engine fake: each case on a fresh page.

import { describe, expect, it } from "@rstest/core";

import { BEHAVIORS } from "./behaviors.ts";
import { fakeTarget } from "./fake-target.ts";

describe("the engine fake", () => {
	for (const behavior of BEHAVIORS) {
		it(behavior.name, async () => {
			const target = fakeTarget();
			try {
				expect(await behavior.run(target)).toEqual(behavior.expected);
			} finally {
				target.end();
			}
		});
	}

	it("has a case for each behavior, each naming the engine source it follows", () => {
		expect(BEHAVIORS).toHaveLength(17);
		expect(BEHAVIORS.filter((behavior) => !behavior.source.startsWith("core/"))).toEqual([]);
	});
});
