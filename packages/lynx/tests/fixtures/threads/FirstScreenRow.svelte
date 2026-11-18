<script lang="ts">
	// A row component whose root is the deferred `<list-item>`: its list is in another component.
	let { id, prefix }: { id: number; prefix: string } = $props();
</script>

<list-item item-key="{prefix}{id}" defer>
	<text class="{prefix}-{id}">{prefix} {id}</text>
</list-item>
