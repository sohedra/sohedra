// Generated pages, changed after they are on screen.

import { describe, it } from "@rstest/core";

import { updatesProperty } from "./properties.ts";
import { check, TIMEOUT } from "./settings.ts";

describe.each([
	["with a first frame", true, 2],
	["with no first frame", false, 3],
] as const)("a generated page %s", (_, firstFrame, offset) => {
	it(
		"shows what the background rendered after every change",
		async () => {
			await check(updatesProperty(firstFrame), offset);
		},
		TIMEOUT,
	);
});
