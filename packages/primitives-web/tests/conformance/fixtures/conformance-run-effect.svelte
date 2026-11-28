<!-- Runs `run` once, in an effect after it mounts. -->
<script lang="ts">
	import { untrack } from "svelte";

	let { run }: { run: () => void } = $props();

	$effect(() => {
		untrack(run);
	});
</script>
