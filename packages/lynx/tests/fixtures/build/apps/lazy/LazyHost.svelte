<script lang="ts">
	import type { Component } from "svelte";

	// Imported before the page started, when there is such an import.
	let { early }: { early?: Promise<Component> } = $props();

	// Loaded on a tap.
	let Loaded = $state<Component | null>(null);

	function load() {
		import("./Heavy.svelte").then((module) => (Loaded = module.default));
	}
</script>

<view class="load" ontap={load}><text>load</text></view>
{#if Loaded}<Loaded />{/if}
{#if early}{#await early then Early}<Early />{/await}{/if}
