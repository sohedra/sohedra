<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	// Reads a query in a template, only while `show` is on.
	let {
		show = true,
		query = "(min-width: 600px)",
		fallback,
	}: { show?: boolean; query?: string; fallback?: boolean } = $props();

	// svelte-ignore state_referenced_locally
	const matches = new MediaQuery(query, fallback);
</script>

{#if show}
	<text class="answer">{matches.current ? "yes" : "no"}</text>
{/if}
<text class="always">here</text>
