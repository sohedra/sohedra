<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
</script>

<view
	class="box"
	{@attach (node) => {
		handles["box"] = node;
	}}
></view>
