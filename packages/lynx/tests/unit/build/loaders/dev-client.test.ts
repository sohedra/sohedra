// Lynx's dev client, in a development build: the loader puts the binding's two calls first in
// `reloadPage` and `logBuildErrors`, touches nothing else, and warns when Lynx changed either.

import fs from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";

import devClientLoader, { DEV_CLIENT_FILE } from "../../../../src/build/loaders/dev-client.ts";
import { runLoader } from "./loader-context.ts";

const require = createRequire(import.meta.url);
const files = {
	reloadApp: require.resolve("@lynx-js/webpack-dev-transport/reloadApp"),
	logBuildErrors: require
		.resolve("@lynx-js/webpack-dev-transport/reloadApp")
		.replace("reloadApp.js", "logBuildErrors.js"),
};
const DEV_CLIENT = "/abs/path/to/dev-client.ts";

const run = (file: string, source = fs.readFileSync(file, "utf8")) =>
	runLoader(devClientLoader, source, { file, options: { devClient: DEV_CLIENT } });

describe("the dev client's files", () => {
	it("are its reloadApp and logBuildErrors modules, and nothing else", () => {
		for (const file of Object.values(files)) {
			expect(DEV_CLIENT_FILE.test(file)).toBe(true);
			expect(DEV_CLIENT_FILE.test(file.replace(/\//g, "\\"))).toBe(true);
		}
		expect(DEV_CLIENT_FILE.test(files.reloadApp.replace("reloadApp.js", "index.js"))).toBe(false);
	});
});

describe("the dev-client loader", () => {
	it("asks first in reloadPage whether DevTool can load the page, and returns when it cannot", async () => {
		const { code, warnings } = await run(files.reloadApp);
		expect(warnings).toEqual([]);
		expect(code).toMatch(
			/function reloadPage\(\) \{\n\s*if \(__sohedraReloadNeedsDevTool\(\)\) return;/,
		);
		expect(code).toContain(
			`import { reloadNeedsDevTool as __sohedraReloadNeedsDevTool } from "${DEV_CLIENT}";`,
		);
	});

	it("reports the build's errors first in logBuildErrors", async () => {
		const { code, warnings } = await run(files.logBuildErrors);
		expect(warnings).toEqual([]);
		expect(code).toMatch(
			/function logBuildErrors\(errors\) \{\n\s*__sohedraReportBuildErrors\(errors\);/,
		);
		expect(code).toContain(
			`import { reportBuildErrors as __sohedraReportBuildErrors } from "${DEV_CLIENT}";`,
		);
	});

	it.each(Object.entries(files))(
		"changes nothing else of %s, which still parses",
		async (_, file) => {
			const source = fs.readFileSync(file, "utf8");
			const { code } = await run(file, source);
			const rest = code!
				.split("\n")
				.filter((line) => !line.includes("__sohedra"))
				.join("\n");
			expect(rest).toBe(source);
			expect(() =>
				acorn.parse(code!, { ecmaVersion: "latest", sourceType: "module" }),
			).not.toThrow();
		},
	);

	it("warns, and leaves the file, when Lynx changed the function", async () => {
		const changed = fs
			.readFileSync(files.reloadApp, "utf8")
			.replace("function reloadPage()", "function reloadSomething()");
		const { code, warnings } = await run(files.reloadApp, changed);
		expect(code).toBe(changed);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]!.message).toMatch(
			/^Lynx's dev client has changed: `function reloadPage\(\) \{`/,
		);
	});
});
