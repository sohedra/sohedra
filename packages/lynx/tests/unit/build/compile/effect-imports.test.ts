// The first frame's copy of a component keeps the `import()` calls of its effects, so the build
// still follows them: Svelte's server compiler drops an effect's body.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

const effects = `<script>
	import { onMount } from "svelte";
	$effect(() => { import("./A.svelte"); });
	$effect.pre(() => { import("./B.svelte"); });
	$effect.root(() => { import("./C.svelte"); const n = "x"; import(n); import(\`./d\`); });
	function later() { import("./E.svelte"); }
</script>
<view></view>`;

describe("the effects' imports on the main thread", () => {
	it("are kept in a function that never runs, for each kind of effect", async () => {
		const { code } = await component(effects, { thread: "main-thread" });
		expect(code).toMatch(
			/function __svelteLynxEffectImports\(\) \{\s*import\("\.\/A\.svelte"\);\s*import\("\.\/B\.svelte"\);\s*import\("\.\/C\.svelte"\);\s*\}/,
		);
	});

	it("leave out an import that is not in an effect, which Svelte keeps, and one that is not a string", async () => {
		const { code } = await component(effects, { thread: "main-thread" });
		expect(code.match(/import\("\.\/E\.svelte"\)/g)).toHaveLength(1);
		expect(code).not.toMatch(/__svelteLynxEffectImports[^}]*(import\(n\)|`\.\/d`)/);
	});

	it("are written once for an import that two effects share", async () => {
		const source = `<script>$effect(() => { import("./A.svelte"); }); $effect(() => { import("./A.svelte"); });</script><view></view>`;
		const { code } = await component(source, { thread: "main-thread" });
		expect(code.match(/import\("\.\/A\.svelte"\)/g)).toHaveLength(1);
	});

	it("are not added to a component without an effect import", async () => {
		const { code } = await component(
			"<script>$effect(() => console.log(1));</script><view></view>",
			{ thread: "main-thread" },
		);
		expect(code).not.toContain("__svelteLynxEffectImports");
	});

	it("are not added on the background, where the effect runs", async () => {
		const { code } = await component(effects, { thread: "background" });
		expect(code).not.toContain("__svelteLynxEffectImports");
		expect(code).toContain('import("./A.svelte")');
	});

	it("are written as a literal that no character of the specifier can leave", async () => {
		const source = `<script>$effect(() => { import("./a<b>\u2028.ts"); });</script><view></view>`;
		const { code } = await component(source, { thread: "main-thread" });
		expect(code).toContain('import("./a\\u003cb\\u003e\\u2028.ts")');
	});
});

// A package that says it has no side effects is left out of a production build where nothing reads
// its exports, and with it the main-thread functions it registers as it loads.
const dropped = `<script lang="ts">
	import { triple } from "lib-effect";
	import { act } from "lib-action";
	import { attach } from "lib-attach";
	import { shown } from "lib-shown";
	import type { Kind } from "lib-type";
	import { type Other, other } from "lib-other";
	const kind: Kind | Other = "a";
	$effect(() => { triple(kind); });
</script>
<view use:act {@attach attach}><text>{shown}{other}</text></view>`;

/** The body of the function that never runs, in a copy's code. */
const keeper = (code: string): string =>
	/function __svelteLynxEffectImports\(\) \{([^}]*)\}/.exec(code)?.[1] ?? "";

describe("the imports Svelte's server copy drops, on the main thread", () => {
	it("are read in the function that never runs: an effect's, an action's and an attachment's", async () => {
		const { code } = await component(dropped, { thread: "main-thread" });
		for (const name of ["triple", "act", "attach"])
			expect(keeper(code)).toMatch(new RegExp(`\\b${name}\\b`));
	});

	it("leave out a type, and an import the server copy reads itself", async () => {
		const { code } = await component(dropped, { thread: "main-thread" });
		for (const name of ["Kind", "Other", "shown", "other"])
			expect(keeper(code)).not.toMatch(new RegExp(`\\b${name}\\b`));
	});
});
