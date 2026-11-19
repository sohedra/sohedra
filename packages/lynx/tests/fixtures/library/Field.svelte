<script lang="ts">
	// A headless field: its own label, everything else on the element.
	let { label, ...rest }: { label: string; [attribute: string]: unknown } = $props();
</script>

<view class="field" {...rest}>
	<text>{label}</text>
</view>
