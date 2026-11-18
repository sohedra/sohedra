<!-- A main-thread function that captures a $state object that holds itself. -->
<script lang="ts">
	interface Tree {
		n: number;
		self?: Tree;
	}

	const node: Tree = { n: 1 };
	node.self = node;
	let tree = $state(node);

	function onTap() {
		"main thread";
		console.log(tree);
	}
</script>

<view class="before"><text>before</text></view>
<view class="tap" main-thread:ontap={onTap}><text>tap</text></view>
