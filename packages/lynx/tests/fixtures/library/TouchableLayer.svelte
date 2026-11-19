<script lang="ts">
	// oxlint-disable-next-line typescript/no-explicit-any -- the test reads what the attachments got
	let { handles }: { handles: Record<string, any> } = $props();
</script>

<view class="layer">
	<text class="inside" {@attach (node) => void (handles.inside = node)}>Inside</text>
</view>
