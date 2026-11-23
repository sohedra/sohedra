<script lang="ts">
	import DeferredRowItem from "./DeferredRowItem.svelte";

	// Two lists of the same row component: each counts its own initial rows.
	const rows = Array.from({ length: 20 }, (_, index) => index + 1);
</script>

<list class="first" custom-list-name="list-container">
	{#each rows as id (id)}
		<DeferredRowItem {id} prefix="a" />
	{/each}
</list>
<list class="second" custom-list-name="list-container">
	{#each rows as id (id)}
		<DeferredRowItem {id} prefix="b" />
	{/each}
</list>
