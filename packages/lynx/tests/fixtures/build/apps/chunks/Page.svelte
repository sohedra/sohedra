<script lang="ts">
	import type { Component } from "svelte";

	import { greeting } from "./shared.ts";

	let { name }: { name: string } = $props();
	let count = $state(0);
	// A bundle of its own, loaded on a tap, beside the page's split chunks.
	let Lazy = $state<Component | null>(null);

	function load() {
		import("./Lazy.svelte").then((module) => (Lazy = module.default));
	}
</script>

<view class="button" ontap={() => count++}>
	<text>{greeting(name)} {count}</text>
</view>
<view class="load" ontap={load}><text>load</text></view>
{#if Lazy}<Lazy />{/if}
