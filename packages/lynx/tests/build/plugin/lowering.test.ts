// Syntax that PrimJS refuses or gets wrong (notes' primjs-gaps § 2) is lowered on both threads: the
// background by @lynx-js/rsbuild-plugin's ES2017 list, the main thread by the binding's own. The
// built scripts have none of it left, and the page's checks hold on threads shaped like a device's.

import { beforeAll, describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";

import { scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";
import { startDevicePage } from "../device-threads.ts";
import { sharedBuild } from "../shared-build.ts";

let build: AppBuild;

beforeAll(async () => {
	build = await sharedBuild("production", "lowering");
}, 180_000);

/** A node of acorn's tree, as far as this reads it. */
interface Node {
	type: string;
	start: number;
	operator?: string;
	left?: Node;
	regex?: { pattern: string; flags: string };
}

/** What PrimJS refuses or gets wrong in `node`, by name. */
function refused(node: Node): string | undefined {
	if (node.type === "LogicalExpression" && node.operator === "??") return "??";
	if (node.type === "AssignmentExpression" && ["??=", "||=", "&&="].includes(node.operator!))
		return node.operator;
	if (node.type === "StaticBlock") return "static block";
	if (node.type === "BinaryExpression" && node.left?.type === "PrivateIdentifier") return "#x in";
	if (node.regex && /\\[pP]\{/.test(node.regex.pattern) && node.regex.flags.includes("u"))
		return "\\p{…}";
	return undefined;
}

/** Each of `refused` in a script, with its text. */
function refusedIn(code: string): string[] {
	const found: string[] = [];
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (typeof value !== "object" || value === null) return;
		const node = value as Node;
		if (typeof node.type === "string") {
			const what = refused(node);
			if (what) found.push(`${what}: ${code.slice(node.start, node.start + 40)}`);
		}
		for (const child of Object.values(node)) visit(child);
	};
	visit(acorn.parse(code, { ecmaVersion: "latest", sourceType: "script" }));
	return found;
}

describe("syntax PrimJS refuses or gets wrong", () => {
	it("is lowered in both threads' scripts", () => {
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		expect(mainThread).toContain("Émile");
		expect(background).toContain("Émile");
		expect({ mainThread: refusedIn(mainThread), background: refusedIn(background) }).toEqual({
			mainThread: [],
			background: [],
		});
	});

	it("keeps its meaning, in the first frame and on the background", async () => {
		const { page } = startDevicePage(scriptsOf(build));
		try {
			const checks = Array.from({ length: 10 }, () => "true").join(" ");
			expect(page.engine.texts()).toEqual([checks]);
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual([checks]);
		} finally {
			page.dispose();
		}
	});
});
