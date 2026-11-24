<!-- `svelte/motion`: a spring, a tween and `prefersReducedMotion`, read as the page renders. -->
<script lang="ts">
	import { prefersReducedMotion, Spring, Tween } from "svelte/motion";

	const spring = new Spring(0);
	const tween = new Tween(0);
</script>

<view class="root">
	<text class="spring">{spring.current}</text>
	<text class="tween">{tween.current}</text>
	<text class="reduced">{String(prefersReducedMotion.current)}</text>
	<view class="move" ontap={() => ((spring.target = 10), (tween.target = 10))}></view>
</view>
