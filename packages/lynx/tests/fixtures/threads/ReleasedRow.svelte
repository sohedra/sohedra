<script lang="ts">
	let { row, handles }: { row: { id: number; label: string }; handles: Record<string, unknown> } =
		$props();
	let taps = $state(0);
	let typed = $state("");
</script>

<view
	class="row row-{row.id}"
	ontap={() => taps++}
	{@attach (node) => {
		handles[`row-${row.id}`] = node;
	}}
>
	<text class="label">{row.label}: {taps}</text>
	<input
		class="kept"
		value={typed}
		oninput={(event: { detail: { value: string } }) => (typed = event.detail.value)}
	/>
	<input class="loose" />
</view>
