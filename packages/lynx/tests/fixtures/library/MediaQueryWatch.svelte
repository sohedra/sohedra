<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	// An effect that reads a query, and says what it read each time it runs.
	let { query, saw }: { query: string; saw: (value: boolean) => void } = $props();

	// svelte-ignore state_referenced_locally
	const matches = new MediaQuery(query);

	$effect(() => {
		saw(matches.current);
	});
</script>

<text class="watching">watching</text>
