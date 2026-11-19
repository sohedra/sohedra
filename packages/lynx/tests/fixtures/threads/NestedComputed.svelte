<!-- A list inside a list's row, and an element whose styles a component sets and reads. -->
<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
	let groups = $state([{ id: 1, items: ["one"] }]);
	handles["groups"] = groups;
	const keep = (name: string) => (node: unknown) => {
		handles[name] = node;
	};
</script>

<list class="outer">
	{#each groups as group (group.id)}
		<list-item>
			<list class="inner inner-{group.id}">
				{#each group.items as item (item)}
					<list-item><text>{item}</text></list-item>
				{/each}
			</list>
		</list-item>
	{/each}
</list>
<view class="box" {@attach keep("box")}></view>
