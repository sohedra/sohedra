<script lang="ts">
	let { value = $bindable() }: { value?: number } = $props();
	// The child gives the bound value its start as it starts.
	if (value === undefined) value = 1;
</script>

<view class="bound" data-v={value}></view>
