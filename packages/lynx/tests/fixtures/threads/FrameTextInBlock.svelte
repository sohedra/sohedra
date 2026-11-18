<script lang="ts">
	import { background } from "@sohedra/lynx/env";

	let { prefix = true }: { prefix?: boolean } = $props();
</script>

<view class="root"
	><text class="t"
		>{#if background}{#if prefix}A{/if}B<text class="i">i</text>{:else}B<text class="f">f</text
			><text class="f">f</text>A{/if}</text
	></view
>
