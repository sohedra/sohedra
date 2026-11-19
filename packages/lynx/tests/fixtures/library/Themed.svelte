<script lang="ts">
	// Reads a context the test gives, and exports a function that changes its state.
	import { getContext } from "svelte";

	const theme = getContext<string>("theme");
	let count = $state(0);

	export function bump(): number {
		return ++count;
	}
</script>

<text>{theme ?? "no theme"} {count}</text>
