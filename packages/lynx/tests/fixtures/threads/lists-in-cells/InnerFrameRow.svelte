<!--
	A list in a cell of a list of the page, with a row only the first frame draws.
-->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";
	let { log }: { log: unknown[] } = $props();
</script>

<list class="page-list" custom-list-name="list-container" initial-item-count={4}>
	<list-item item-key="one">
		<text class="s-head" ontap={() => log.push("s-head")}>head</text>
		<list class="inner" custom-list-name="list-container">
			<list-item item-key="in-a"><text class="s-inner">a</text></list-item>
			{#if !background}<list-item item-key="in-frame"
					><text class="s-frame">frame-only</text></list-item
				>{/if}
			<list-item item-key="in-z"><text class="s-inner">z</text></list-item>
		</list>
		<text class="s-tail" ontap={() => log.push("s-tail")}>tail</text>
	</list-item>
</list>
