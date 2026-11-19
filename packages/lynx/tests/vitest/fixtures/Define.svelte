<script lang="ts">
	// Tells which thread's copy renders, by a constant the plugin's `define` sets for each thread.
	declare const __APP_THREAD__: string;

	let { onrender }: { onrender: (thread: string) => void } = $props();
	// svelte-ignore state_referenced_locally
	onrender(__APP_THREAD__);
</script>

<text>{__APP_THREAD__}</text>
