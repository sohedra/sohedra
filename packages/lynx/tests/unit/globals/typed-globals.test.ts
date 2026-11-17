import { describe, expect, it } from "@rstest/core";

import { background } from "../../../src/background/globals.ts";
import { environment } from "../../../src/build/globals.ts";
import { firstFrame } from "../../../src/first-frame/globals.ts";
import { mainThread } from "../../../src/main-thread/globals.ts";

describe("a folder's typed globals", () => {
	it("are the thread's own globals, not a copy", () => {
		expect(background).toBe(globalThis);
		expect(mainThread).toBe(globalThis);
		expect(firstFrame).toBe(globalThis);
	});

	it("give the build the process's environment", () => {
		expect(environment).toBe(process.env);
	});
});
