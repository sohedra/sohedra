<!-- A render snippet that writes its own `onclick` after the spread. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";

	let { mine }: { mine: (event: MouseEvent) => void } = $props();
</script>

<SwitchRoot>
	{#snippet render({ props })}
		<span {...props} style="display: inline-block; width: 16px; height: 16px" onclick={mine}></span>
	{/snippet}
</SwitchRoot>
