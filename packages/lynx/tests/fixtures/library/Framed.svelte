<script lang="ts">
	// A tap asks the background for a frame, which counts it, as an animation's step would.
	let frames = $state(0);
</script>

<view class="root">
	<text class="frames">{frames}</text>
	<view class="next" ontap={() => requestAnimationFrame(() => frames++)}></view>
</view>
