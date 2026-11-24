// A production page says nothing of a scroll view's many rows: the warning is development only.

import { describe, expect, it, rs } from "@rstest/core";

import * as globals from "../../src/background/globals.ts" with { rstest: "importActual" };
import ManyScrollRows from "../fixtures/threads/ManyScrollRows.svelte";

rs.mock("../../src/background/globals.ts", () => ({ ...globals, DEV: false }));

const { startSveltePage } = await import("./svelte-page.ts");

describe("a <scroll-view> with many rows, in a production build", () => {
	it("gives no warning", async () => {
		const page = startSveltePage(ManyScrollRows, { props: { count: 201 } });
		await page.settle();
		// Boundary: the page keeps what was reported as it was given.
		const codes = (page.warnings as { code?: unknown }[]).map((warning) => warning.code);
		expect(codes).not.toContain("scroll_view_many_children");
		expect(page.engine.texts()).toHaveLength(202);
	});
});
