<!--
	A list in a cell of a list of the page, whose rows the threads may have more or fewer of, and a
	deferred row, so the build counts its rows with a block of its own.
-->
<script lang="ts">
	let { inner, log }: { inner: string[]; log: unknown[] } = $props();
</script>

<list class="page-list" custom-list-name="list-container" initial-item-count={4}>
	<list-item item-key="one">
		<text class="s-head" ontap={() => log.push("s-head")}>head</text>
		<list class="inner" custom-list-name="list-container">
			{#each inner as i (i)}
				<list-item item-key="in-{i}"
					><text class="s-inner" ontap={() => log.push("s-inner")}>{i}</text></list-item
				>
			{/each}
			<list-item item-key="in-deferred" defer><text class="s-deferred">d</text></list-item>
		</list>
		<text class="s-tail" ontap={() => log.push("s-tail")}>tail</text>
	</list-item>
</list>
