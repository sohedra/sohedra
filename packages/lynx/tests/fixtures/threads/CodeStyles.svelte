<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
	let color = $state("red");
	let wide = $state(false);
</script>

<view
	class="box"
	style="color: {color};{wide ? ' width: 10px;' : ''}"
	{@attach (node) => {
		handles["box"] = node;
	}}
></view>
<view class="plain" style="color: {color};"></view>
<view class="recolor" ontap={() => (color = color === "red" ? "blue" : "red")}>
	<text>recolor</text>
</view>
<view class="widen" ontap={() => (wide = !wide)}><text>widen</text></view>
