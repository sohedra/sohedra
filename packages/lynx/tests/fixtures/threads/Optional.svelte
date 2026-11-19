<script lang="ts">
	let { show, onclean }: { show: boolean; onclean?: () => void } = $props();
	$effect(() => () => onclean?.());
</script>

{#if show}
	<view class="shown" ontap={() => {}}><text>shown</text></view>
{/if}
