<script lang="ts">
	import type { Component } from "svelte";

	// Loaded on a tap.
	let Loaded = $state<Component | null>(null);

	function load() {
		import("./Heavy.svelte").then((module) => (Loaded = module.default));
	}
</script>

<view ontap={load}><text>load</text></view>
{#if Loaded}<Loaded />{/if}
