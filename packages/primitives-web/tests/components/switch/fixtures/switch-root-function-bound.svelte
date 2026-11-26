<!-- A function binding: `bind:checked={get, set}`. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/types.js";

	let {
		get,
		set,
		...rest
	}: { get: () => boolean; set: (value: boolean) => void } & SwitchRootProps = $props();
</script>

<SwitchRoot bind:checked={get, set} {...rest} />
