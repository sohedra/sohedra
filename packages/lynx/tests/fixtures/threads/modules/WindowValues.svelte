<!-- `svelte/reactivity/window`: the window's size, read as the page renders. -->
<script lang="ts">
	import { innerHeight, innerWidth } from "svelte/reactivity/window";
</script>

<view class="root">
	<text class="size">{innerWidth.current} x {innerHeight.current}</text>
</view>
