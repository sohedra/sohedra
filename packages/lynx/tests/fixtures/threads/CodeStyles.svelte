<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();
	let color = $state("red");
	let wide = $state(false);
	let tone = $state<string | null>("red");
	handles["recolor"] = () => (color = color === "red" ? "blue" : "red");
	handles["retone"] = (next: string | null) => (tone = next);
</script>

<view
	class="box"
	style="color: {color};{wide ? ' width: 10px;' : ''}"
	{@attach (node) => {
		handles["box"] = node;
	}}
>
	<view class="swatch"></view>
</view>
<view class="plain" style="color: {color};"></view>
<view
	class="toned"
	style={tone ? `--tone: ${tone}` : ""}
	{@attach (node) => {
		handles["toned"] = node;
	}}
>
	<view class="toned-child"></view>
</view>
<view class="recolor" ontap={() => (color = color === "red" ? "blue" : "red")}>
	<text>recolor</text>
</view>
<view class="widen" ontap={() => (wide = !wide)}><text>widen</text></view>
