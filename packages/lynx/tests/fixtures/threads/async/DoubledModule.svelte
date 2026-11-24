<!-- `Doubled`, with its `$derived(await …)` in a rune module. -->
<script lang="ts">
	import { doubling } from "./doubled.svelte.ts";

	let count = $state(1);
	const doubled = await doubling(() => count);
</script>

<view class="doubled">
	<text class="value">Doubled: {doubled.value}</text>
	<view class="add" ontap={() => count++}><text>add</text></view>
</view>
