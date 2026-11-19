<!-- The page's root component: its props, and the context it is mounted with. -->
<script lang="ts">
	import { getContext } from "svelte";

	let { title = "", route = "" }: { title?: string; route?: string } = $props();
	const theme = getContext<string | undefined>("theme") ?? "none";
</script>

<view class="page">
	<text class="title">{title}</text>
	<text class="route">{route}</text>
	<text class="theme">{theme}</text>
</view>
