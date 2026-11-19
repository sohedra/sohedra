<script lang="ts">
	let rows = $state([
		{ id: 1, label: "one" },
		{ id: 2, label: "two" },
		{ id: 3, label: "three" },
	]);
	let extra = $state(true);
	let tapped = $state<unknown[]>([]);
	export function reverse() {
		rows = rows.toReversed();
	}
</script>

<view class="header"><text>Rows</text></view>
{#each rows as row (row.id)}
	<view
		class="row row-{row.id}"
		id="row-{row.id}"
		data-id={row.id}
		data-label={row.label}
		ontap={(event: { target: unknown }) => tapped.push(event.target)}
	>
		<text>{row.label}</text>
		<view class="remove remove-{row.id}" oncatchtap={() => (rows = rows.filter((r) => r !== row))}>
			<text>x</text>
		</view>
	</view>
{/each}
{#if extra}
	<view class="extra" ontap={() => (extra = false)} ontapcapture={() => {}}><text>extra</text></view
	>
{/if}
<view class="reverse" ontap={() => (rows = rows.toReversed())}><text>reverse</text></view>
<text class="count">{tapped.length}</text>
