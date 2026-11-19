<script lang="ts">
	let { row, handles }: { row: { id: number; label: string }; handles: Record<string, unknown> } =
		$props();
	let taps = $state(0);
	(handles["rendered"] as number[]).push(row.id);
	$effect(() => () => void (handles["unmounted"] as number[]).push(row.id));
</script>

<view class="row row-{row.id}" ontap={() => taps++}>
	<text class="label">{row.label}: {taps}</text>
</view>
