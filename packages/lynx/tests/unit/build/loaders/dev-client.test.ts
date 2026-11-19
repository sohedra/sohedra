// Lynx's dev client, in a development build: the loader puts the binding's two calls first in
// `reloadPage` and `logBuildErrors`, touches nothing else, and warns when Lynx changed either.

import fs from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";

import devClientLoader, {
	DEV_CLIENT_FILE,
	missingDevClientFiles,
} from "../../../../src/build/loaders/dev-client.ts";
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

describe("the dev-client loader, against a changed dev client", () => {
	it("warns, and leaves the file, when the function is there twice", async () => {
		const source = fs.readFileSync(files.logBuildErrors, "utf8");
		const twice = `${source}\nfunction logBuildErrors(errors) {}\n`;
		const { code, warnings } = await run(files.logBuildErrors, twice);
		expect(code).toBe(twice);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]!.message).toMatch(
			/^Lynx's dev client has changed: `function logBuildErrors\(errors\) \{` is not in .*logBuildErrors\.js exactly once, so build errors stay out of LogBox\./,
		);
	});

	it("names only what the moved file loses", async () => {
		const changed = fs
			.readFileSync(files.reloadApp, "utf8")
			.replace("function reloadPage()", "function x()");
		const { warnings } = await run(files.reloadApp, changed);
		expect(warnings[0]!.message).toContain(
			"a change that needs DevTool to load the page says nothing",
		);
		expect(warnings[0]!.message).not.toContain("build errors");
	});
});

describe("missingDevClientFiles", () => {
	const folder = files.reloadApp.replace("reloadApp.js", "");

	it("finds nothing missing in a build with the dev client and both files", () => {
		expect(
			missingDevClientFiles([`${folder}index.js?hot=true`, files.reloadApp, files.logBuildErrors]),
		).toEqual([]);
	});

	it("names a file a build with the dev client lacks: Lynx renamed it, or the dev client is older", () => {
		expect(missingDevClientFiles([`${folder}index.js?hot=true`, files.reloadApp])).toEqual([
			"@lynx-js/webpack-dev-transport/lib/client/logBuildErrors.js",
		]);
		expect(missingDevClientFiles([`${folder}index.js`])).toEqual([
			"@lynx-js/webpack-dev-transport/lib/client/reloadApp.js",
			"@lynx-js/webpack-dev-transport/lib/client/logBuildErrors.js",
		]);
	});

	it("finds nothing missing in a build without the dev client, as a production build", () => {
		expect(missingDevClientFiles(["/app/src/index.ts"])).toEqual([]);
	});
});
