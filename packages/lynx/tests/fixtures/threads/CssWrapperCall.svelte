<script lang="ts">
	import CssChild from "./CssChild.svelte";
	let { handles }: { handles: Record<string, unknown> } = $props();
</script>

<view
	class="host"
	{@attach (node) => {
		handles["host"] = node;
	}}
>
	<CssChild --tone="green" />
</view>
