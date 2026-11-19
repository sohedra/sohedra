<script lang="ts">
	import MediaQueryWatch from "./MediaQueryWatch.svelte";

	// The effect that reads the query lives in a child, which `show` takes away.
	let {
		show = true,
		query = "(min-width: 600px)",
		saw,
	}: { show?: boolean; query?: string; saw: (value: boolean) => void } = $props();
</script>

{#if show}
	<MediaQueryWatch {query} {saw} />
{/if}
<text class="always">here</text>
