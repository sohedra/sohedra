<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { label = "label" }: { label?: string } = $props();
</script>

<view class="root"
	><text class="t"
		>{#if background}<text class="b">B</text>{/if}{label}</text
	></view
>
