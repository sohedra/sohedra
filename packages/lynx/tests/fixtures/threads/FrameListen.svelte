<script lang="ts">
	import { on } from "svelte/events";

	let { log }: { log: unknown[] } = $props();
</script>

<view class="box" {@attach (node) => on(node, "tap", () => log.push("on"))}>
	<text class="inner">inner</text>
</view>
