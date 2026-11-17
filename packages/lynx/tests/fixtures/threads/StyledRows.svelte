<script lang="ts">
	type Node = {
		setStyleProperty(name: string, value: string): void;
		animate(keyframes: Record<string, number>[], duration: number): unknown;
	};
	let { handles }: { handles: Record<string, unknown> } = $props();
	const rows = ["a", "b", "c"];
</script>

<list class="list">
	{#each rows as row (row)}
		<list-item>
			<view
				class="row-{row}"
				{@attach (node) => {
					handles[row] = node;
					(node as unknown as Node).setStyleProperty("color", "red");
					(node as unknown as Node).animate([{ opacity: 0 }, { opacity: 1 }], 100);
				}}
			>
				<text>{row}</text>
			</view>
		</list-item>
	{/each}
</list>
