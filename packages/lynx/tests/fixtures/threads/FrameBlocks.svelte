<script lang="ts">
	import { background } from "@sohedra/lynx/environment";
	import { onMount } from "svelte";

	let { tone = "plain", log = [] }: { tone?: string; log?: unknown[] } = $props();
	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<view class="top"><text>top</text></view>
{#if background}
	<view class="background-only" ontap={() => log.push("background-only")}
		><text>background</text></view
	>
{/if}
{#if tone === "loud"}
	<text class="tone loud">LOUD</text>
{:else}
	<view class="tone"><text>plain</text></view>
{/if}
{#if tone === "loud"}
	<view class="badge loud"><text>!</text></view>
{:else}
	<view class="badge"><text>.</text></view>
{/if}
<view class="bottom" data-mounted={mounted}><text>{mounted ? "mounted" : "drawn"}</text></view>
