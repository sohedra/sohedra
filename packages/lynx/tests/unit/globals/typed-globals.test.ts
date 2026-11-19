import { describe, expect, it } from "@rstest/core";

import { background } from "../../../src/background/globals.ts";
import { environment } from "../../../src/build/globals.ts";
import { firstFrame } from "../../../src/first-frame/globals.ts";
import { mainThread } from "../../../src/main-thread/globals.ts";
import { installGlobals } from "../../../src/testing/globals.ts";

describe("a folder's typed globals", () => {
	it("are the thread's own globals, not a copy", () => {
		expect(mainThread).toBe(globalThis);
		expect(firstFrame).toBe(globalThis);
	});

	it("read the background's lynx by its name, which a device gives the bundle's wrapper, when it is used", () => {
		const first = { name: "first" };
		const second = { name: "second" };
		const restore = installGlobals({ lynx: first });
		try {
			expect(background.lynx).toBe(first);
			installGlobals({ lynx: second });
			expect(background.lynx).toBe(second);
		} finally {
			restore();
		}
	});

	it("give the build the process's environment", () => {
		expect(environment).toBe(process.env);
	});
});
