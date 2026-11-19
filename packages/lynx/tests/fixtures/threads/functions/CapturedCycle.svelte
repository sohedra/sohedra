<!-- A main-thread function that captures a $state object that holds itself, beside a count the page shows. -->
<script lang="ts">
	interface Tree {
		n: number;
		self?: Tree;
	}

	let { api }: { api: Record<string, unknown> } = $props();
	const node: Tree = { n: 1 };
	node.self = node;
	let tree = $state(node);
	let count = $state(0);

	api["count"] = () => count++;

	function onTap() {
		"main thread";
		console.log(tree);
	}
</script>

<view class="before"><text>count {count}</text></view>
<view class="tap" main-thread:ontap={onTap}><text>tap</text></view>
