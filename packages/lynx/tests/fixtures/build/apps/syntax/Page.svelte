<script>
	// JavaScript that TypeScript reads otherwise, in a component without `lang="ts"`: each shape
	// compares in JavaScript, and is a call of `a` (with a type argument) in TypeScript.
	import { compared as fromRuneModule } from "./compare.svelte.js";
	import { compared as fromModule } from "./plain.js";

	const a = 1;
	const b = 2;
	const c = 0;
	// prettier-ignore
	const compared = [
		// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
		a < b > (c),
		// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
		a < b > `0`,
		// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
		a < b > (c ? 0 : 0),
		// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
		a < b > (c, 0),
	];
</script>

<text>component {compared.join(" ")}</text>
<text>rune module {fromRuneModule.join(" ")}</text>
<text>module {fromModule.join(" ")}</text>
