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
// its exports, and with it the main-thread functions it registers as it loads. Svelte's server copy
// drops code (an effect, an action, an attachment, a boundary's children while it is pending), so
// the main thread's copy reads, in a function that never runs, every name the component imports and
// reads as a value.
const dropped = `<script lang="ts">
	import { triple } from "lib-effect";
	import { act } from "lib-action";
	import { attach } from "lib-attach";
	import { shown } from "lib-shown";
	import { waited } from "lib-boundary";
	import type { Kind } from "lib-type";
	import { type Other, other } from "lib-other";
	import { Shape, Sized, Listed, Made, Keyed } from "./shapes.ts";
	const kind: Kind | Other = "a";
	const size = (shape: Shape): number => shape.size;
	$effect(() => {
		const shape = { size: 2 } as Shape;
		const sized: Sized = { size: 3 };
		const listed = [] satisfies Listed[];
		const made = new Map<string, Made>();
		const keyed = { Keyed: 1, value: kind };
		triple(size(shape) + sized.size + listed.length + made.size + keyed.Keyed + made.Keyed);
	});
</script>
<view use:act {@attach attach}><text>{shown}{other}</text></view>
<svelte:boundary>
	<text>{await waited()}</text>
	{#snippet pending()}<text>waiting</text>{/snippet}
</svelte:boundary>`;

/** The body of the function that never runs, in a copy's code. */
const keeper = (code: string): string =>
	/function __svelteLynxEffectImports\(\) \{([^}]*)\}/.exec(code)?.[1] ?? "";

/** Compiled for the main thread, with the boundary's `await` allowed. */
const mainThread = (source: string) =>
	component(source, {
		thread: "main-thread",
		compilerOptions: { experimental: { async: true } },
	});

describe("the names a component imports, on the main thread", () => {
	it("are read in the function that never runs: an effect's, an action's, an attachment's, a boundary's", async () => {
		const { code } = await mainThread(dropped);
		for (const name of ["triple", "act", "attach", "waited"])
			expect(keeper(code)).toMatch(new RegExp(`\\b${name}\\b`));
	});

	it("are read there when the server copy reads them too", async () => {
		const { code } = await mainThread(dropped);
		for (const name of ["shown", "other"])
			expect(keeper(code)).toMatch(new RegExp(`\\b${name}\\b`));
	});

	it("leave out a type: imported as one, or only read as one (`as`, `:`, `satisfies`, an argument), or as a property's name", async () => {
		const { code } = await mainThread(dropped);
		for (const name of ["Kind", "Other", "Shape", "Sized", "Listed", "Made", "Keyed"])
			expect(keeper(code)).not.toMatch(new RegExp(`\\b${name}\\b`));
	});

	it("are read from a component whose only script is its module script", async () => {
		const source = `<script module>\n\timport { triple } from "lib-effect";\n\texport const later = () => triple(2);\n</script>\n<view></view>`;
		const { code } = await mainThread(source);
		expect(keeper(code)).toMatch(/\btriple\b/);
	});
});
