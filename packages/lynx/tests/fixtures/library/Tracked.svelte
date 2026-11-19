<script lang="ts">
	import { onMount } from "svelte";

	import { sent, track } from "./analytics.ts";

	// `inMarkup` uses the module while the first frame renders.
	let { inMarkup = false }: { inMarkup?: boolean } = $props();
	onMount(() => track("mount"));
</script>

<text>{inMarkup ? sent.length : "tracked"}</text>
