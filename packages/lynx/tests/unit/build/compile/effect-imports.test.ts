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
});
