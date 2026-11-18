<!-- A main-thread function that captures $state holding one of the background's elements, by mistake. -->
<script lang="ts">
	let box: unknown = $state(null);
	const keep = (found: unknown) => {
		box = found;
	};

	function onTap() {
		"main thread";
		console.log(box);
	}
</script>

<view class="box" {@attach keep} main-thread:ontap={onTap}><text>tap</text></view>
