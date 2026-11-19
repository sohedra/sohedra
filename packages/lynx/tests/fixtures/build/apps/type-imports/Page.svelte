<script lang="ts">
	// A type imported without `type`, as TypeScript without `verbatimModuleSyntax` allows, and read
	// only as a type in an effect.
	import { Shape } from "./shape.ts";

	let size = $state(0);

	$effect(() => {
		const shape = { size: 2 } as Shape;
		const typed: Shape = shape;
		size = (typed satisfies Shape).size;
	});
</script>

<text>size {size}</text>
