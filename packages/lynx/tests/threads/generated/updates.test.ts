// Generated pages, changed after they are on screen.

import { describe, it } from "@rstest/core";

import { updatesProperty } from "./properties.ts";
import { check } from "./settings.ts";

describe.each([
	["with a first frame", true],
	["with no first frame", false],
])("a generated page %s", (_, firstFrame) => {
	it("shows what the background rendered after every change", async () => {
		await check(updatesProperty(firstFrame));
	});
});
