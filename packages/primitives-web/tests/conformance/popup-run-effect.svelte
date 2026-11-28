<!-- Runs `run` once in an effect after mounting (a layout effect that runs once). -->
<script lang="ts">
	import { untrack } from "svelte";

	let { run }: { run: () => void } = $props();

	$effect(() => {
		untrack(run);
	});
</script>
