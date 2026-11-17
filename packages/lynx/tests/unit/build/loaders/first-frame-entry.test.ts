// The main thread's copy of a page's entry, for the first frame: it imports the entry as written
// in the app's config, so the entry's own imports resolve for the main thread.

import { describe, expect, it } from "@rstest/core";

import firstFrameEntryLoader from "../../../../src/build/loaders/first-frame-entry.ts";
import { runLoader } from "./loader-context.ts";

const load = (query: string) => runLoader(firstFrameEntryLoader, "", { query });

describe("the first frame's copy of an entry", () => {
	it("imports the entry named in the query", async () => {
		expect((await load("?entry=.%2Fsrc%2Findex.ts")).code).toBe('import "./src/index.ts";\n');
	});

	it("takes the first frame away for an entry that does not draw one, and keeps its imports", async () => {
		const { code } = await load("?entry=.%2Findex.ts&firstFrame=off");
		expect(code).toContain('import "./index.ts";');
		expect(code).toContain("delete");
		expect(code).toContain("__svelteLynxFirstFrame");
	});

	it("writes the entry as a literal that survives `<`, `>` and the line separators", async () => {
		const { code } = await load(`?entry=${encodeURIComponent("./a<b>\u2028.ts")}`);
		expect(code).not.toContain("\u2028");
		expect(code).toContain("\\u003cb\\u003e\\u2028");
	});
});
