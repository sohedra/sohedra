<!-- A Switch.Root with a Switch.Thumb inside. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import SwitchThumb from "#lib/components/switch/switch-thumb.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	let { ...rest }: SwitchRootProps = $props();
</script>

<SwitchRoot {...rest}>
	<SwitchThumb data-testid="thumb" style="display: inline-block; width: 16px; height: 16px" />
</SwitchRoot>
