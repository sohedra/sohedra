<!--
  `bind:checked` to the parent's `$state`, shown in `data-testid="bound"`: a binding needs state of
  the parent's own, which the demo's props can't give. Sized so a real pointer can press it.
-->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	let {
		initial,
		style = "display: inline-block; width: 16px; height: 16px",
		...rest
	}: { initial?: boolean } & SwitchRootProps = $props();

	// svelte-ignore state_referenced_locally
	let checked = $state(initial);
</script>

<SwitchRoot bind:checked {style} {...rest} />
<output data-testid="bound">{String(checked)}</output>
