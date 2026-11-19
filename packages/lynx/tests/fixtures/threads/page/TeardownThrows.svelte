<!-- A page whose teardown throws. -->
<script lang="ts">
	$effect(() => () => {
		throw new Error("teardown failed");
	});
</script>

<view class="root"><text>root</text></view>
