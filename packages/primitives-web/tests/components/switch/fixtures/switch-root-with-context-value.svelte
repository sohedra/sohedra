<!-- A switch whose child reads SwitchRootContext. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/types.js";

	import SwitchRootContextValue from "./switch-root-context-value.svelte";

	let props: SwitchRootProps = $props();
</script>

<SwitchRoot {...props}>
	<SwitchRootContextValue />
</SwitchRoot>
