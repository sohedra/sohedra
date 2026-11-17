// The engine behaviour spec, run on the engine fake: each case on a fresh page.

import { describe, expect, it } from "@rstest/core";

import { BEHAVIOURS } from "./behaviours.ts";
import { fakeTarget } from "./fake-target.ts";

describe("the engine fake", () => {
	for (const behaviour of BEHAVIOURS) {
		it(behaviour.name, async () => {
			const target = fakeTarget();
			try {
				expect(await behaviour.run(target)).toEqual(behaviour.expected);
			} finally {
				target.end();
			}
		});
	}

	it("has a case for each behaviour, each naming the engine source it follows", () => {
		expect(BEHAVIOURS).toHaveLength(17);
		expect(BEHAVIOURS.filter((behaviour) => !behaviour.source.startsWith("core/"))).toEqual([]);
	});
});
