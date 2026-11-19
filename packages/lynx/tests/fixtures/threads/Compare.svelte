<script>
	// The rune module's shapes, and the same in a component without `lang="ts"`.
	import { compared as fromModule } from "./compare.svelte.js";

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

<text>{compared.join(" ")}</text>
<text>{fromModule.join(" ")}</text>
