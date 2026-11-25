<!--
	An {#await} with no pending branch, in a cell of a list of the page.
-->
<script lang="ts">
	let { given, log }: { given: unknown; log: unknown[] } = $props();
</script>

<list class="list" custom-list-name="list-container" initial-item-count={1}>
	<list-item item-key="a">
		<text class="before" ontap={() => log.push("before")}>before</text>
		{#await given then value}<text class="item" ontap={() => log.push(`open ${value}`)}
				>{value}</text
			>{/await}
		<text class="after" ontap={() => log.push("after")}>after</text>
	</list-item>
</list>
