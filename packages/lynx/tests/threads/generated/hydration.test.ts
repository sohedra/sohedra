// Generated pages, drawn as a first frame and hydrated.

import { describe, it } from "@rstest/core";

import { firstFrameProperty, hydrationProperty } from "./properties.ts";
import { check, TIMEOUT } from "./settings.ts";

describe("a generated page's first frame", () => {
	it(
		"is what the background renders from the same data",
		async () => {
			await check(firstFrameProperty, 0);
		},
		TIMEOUT,
	);

	it(
		"is hydrated with no mismatch and with the first frame's ids, and shows what the background rendered",
		async () => {
			await check(hydrationProperty, 1);
		},
		TIMEOUT,
	);
});
