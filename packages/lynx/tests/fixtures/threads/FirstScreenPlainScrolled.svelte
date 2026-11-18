<script lang="ts">
	// A list with no deferred row that starts far down, as a chat starts at its last message.
	const rows = Array.from({ length: 200 }, (_, index) => index + 1);
</script>

<list class="list" initial-scroll-index={150}>
	{#each rows as row (row)}
		<list-item item-key="r{row}"><text class="row-{row}">Row {row}</text></list-item>
	{/each}
</list>
