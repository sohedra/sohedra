<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

<view class="slot">{@render children()}</view>
