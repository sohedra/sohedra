<!-- A Switch.Root whose render snippet renders a <button> with a Switch.Thumb inside. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import SwitchThumb from "#lib/components/switch/switch-thumb.svelte";
</script>

<SwitchRoot nativeButton aria-label="render">
	{#snippet render({ props, state })}
		<button {...props} data-snippet-checked={String(state.checked)}>
			<SwitchThumb data-testid="thumb" />
		</button>
	{/snippet}
</SwitchRoot>
