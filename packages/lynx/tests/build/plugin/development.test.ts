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
