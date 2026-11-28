<!-- A switch whose child reads SwitchRootContext: a child the demo doesn't render. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	import SwitchRootContextValue from "./switch-root-context-value.svelte";

	let props: SwitchRootProps = $props();
</script>

<SwitchRoot {...props}>
	<SwitchRootContextValue />
</SwitchRoot>
