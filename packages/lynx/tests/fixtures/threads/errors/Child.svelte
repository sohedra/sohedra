<!-- A child whose effect throws once the parent's count changes. -->
<script lang="ts">
	let { count }: { count: number } = $props();

	$effect(() => {
		if (count > 0) throw new Error("the child's effect threw");
	});
</script>

<text>{count}</text>
