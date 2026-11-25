<script module lang="ts">
	// Code at a module's top level runs when the module loads: once for the main thread's copy (the
	// first frame) and once for the background's.
	import { background } from "@sohedra/lynx/environment";

	export const loadedOn = background ? "background" : "main thread";
	const g = globalThis as { moduleLevelLoads?: string[] };
	(g.moduleLevelLoads ??= []).push(loadedOn);
</script>

<text>{loadedOn}</text>
