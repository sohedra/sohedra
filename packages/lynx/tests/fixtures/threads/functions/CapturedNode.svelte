<!-- A main-thread function that captures one of the background's elements, by mistake, from $state.raw. -->
<script lang="ts">
	let node: unknown = $state.raw(null);
	const keep = (found: unknown) => {
		node = found;
	};

	function onTap() {
		"main thread";
		console.log(node);
	}
</script>

<view class="outer">
	<view class="box" {@attach keep} main-thread:ontap={onTap}><text>tap</text></view>
</view>
