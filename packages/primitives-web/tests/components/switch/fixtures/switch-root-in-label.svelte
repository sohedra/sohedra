<!-- A switch inside a wrapping native label, an ancestor the demo doesn't render. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	let { text = "Toggle", ...rest }: { text?: string } & SwitchRootProps = $props();
</script>

<label data-testid="label">
	<SwitchRoot {...rest} />
	{text}
</label>
