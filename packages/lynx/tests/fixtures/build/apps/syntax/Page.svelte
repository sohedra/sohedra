<script>
	// JavaScript that TypeScript reads otherwise: `a < b > (c)` compares in JavaScript, and is a
	// call of `a` with a type argument in TypeScript.
	import { compared as fromRuneModule } from "./compare.svelte.js";
	import { compared as fromModule } from "./plain.js";

	const a = 1;
	const b = 2;
	const c = 0;
	// prettier-ignore
	// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
	const compared = a < b > (c);
</script>

<text>component {String(compared)}</text>
<text>rune module {String(fromRuneModule)}</text>
<text>module {String(fromModule)}</text>
