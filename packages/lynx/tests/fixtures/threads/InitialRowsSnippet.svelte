<script lang="ts">
	import InitialRowsVirtualList from "./InitialRowsVirtualList.svelte";

	// Deferred rows written in a snippet outside any list, which a list component renders.
	const items = Array.from({ length: 20 }, (_, index) => index + 1);
</script>

{#snippet row(item: number)}
	<list-item item-key="s{item}" defer><text class="s-{item}">s {item}</text></list-item>
{/snippet}
<InitialRowsVirtualList {items} {row} />
