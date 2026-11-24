// A development build of an app with a large `<style>` block: hot reload, and names that stay
// short.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let scripts: ReturnType<typeof scriptsOf>;

beforeAll(async () => {
	build = await buildApp("big-style", { development: true });
	if (build.ok) scripts = scriptsOf(build);
}, 180_000);
afterAll(() => cleanBuild(build));

// A component's CSS rides to the CSS rules inside the name of an import, and in a development
// build the bundler names a module and a variable after that request: past about 4000 characters
// the engine refuses the background script ("identifier too long").
describe("a component with a large <style> block", () => {
	it("builds", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("renames the wrapper's self and navigator, so the code reads the global object's", () => {
		const parameters = /define\("background\.js", function\(([^)]*)\)/
			.exec(scripts.background)![1]!
			.split(",")
			.map((name) => name.trim());
		expect(parameters).toEqual(expect.arrayContaining(["__self", "__navigator", "fetch"]));
		expect(parameters).not.toContain("self");
		expect(parameters).not.toContain("navigator");
	});

	it("puts its rules in the template", () => {
		const selectors: string[] = readTemplate(build)["css"].cssMap["0"].map(
			(rule: { selectorText: { value: string } }) => rule.selectorText.value,
		);
		expect(selectors.some((selector) => selector.startsWith(".big-rule-0."))).toBe(true);
		expect(selectors.some((selector) => selector.startsWith(".big-rule-109."))).toBe(true);
	});

	it("names nothing after them: no name and no module id is long", () => {
		let longest = 0;
		for (const [name] of scripts.background.matchAll(/[A-Za-z_$][\w$]*/g))
			longest = Math.max(longest, name.length);
		expect(longest).toBeLessThan(1000);
		let longestId = 0;
		for (const [, id] of scripts.background.matchAll(/"([^"\\\n]*\.svelte\.css[^"\\\n]*)"/g))
			longestId = Math.max(longestId, id!.length);
		expect(longestId).toBeLessThan(1000);
	});
});

describe("hot reload", () => {
	it("swaps the component in place, with the footer written for Rspack", () => {
		expect(scripts.background).toContain("svelteLynxComponent");
		expect(scripts.background).not.toContain("import.meta.hot");
	});

	it("leaves the main thread's copy as it is: it takes no update", () => {
		expect(scripts.mainThread).not.toContain("svelteLynxComponent");
	});
});

// Strings only the binding's part of the dev client has: the functions the loader calls, and a line
// of its build-error report.
const DEV_CLIENT = ["reloadNeedsDevTool", "reportBuildErrors", "the terminal shows all"];

describe("Lynx's dev client", () => {
	it("calls the binding first where it reloads the page and logs build errors, on the background", () => {
		for (const text of DEV_CLIENT) expect(scripts.background).toContain(text);
		// Before anything else the function does: SWC's lowering declares its variables first.
		expect(scripts.background).toMatch(
			/function reloadPage\(\) \{(?:\s*var [^;]*;)*\s*if \([^\n]*reloadNeedsDevTool\)\(\)\) return;/,
		);
		expect(scripts.background).toMatch(
			/function logBuildErrors\(errors\) \{\s*[^\n]*reportBuildErrors\)\(errors\);/,
		);
		// The dev client's own code is still there after the calls.
		expect(scripts.background).toContain("[HMR] reload failed: cannot invoke cdp from DevTool.");
		expect(scripts.background).toContain("Errors while compiling. Reload prevented.");
	});

	it("is not on the main thread", () => {
		for (const text of DEV_CLIENT) expect(scripts.mainThread).not.toContain(text);
	});
});
