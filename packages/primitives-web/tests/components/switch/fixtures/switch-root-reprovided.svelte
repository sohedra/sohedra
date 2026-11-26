<!--
  A parent that spreads a props object into Switch.Root and can replace it with an equal one
  (`setProps`), as a re-rendering list or a wrapper does. Optionally renders a native button
  through the render snippet.
-->
<script lang="ts">
	import type { Attachment } from "svelte/attachments";

	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	let {
		attach,
		renderButton = false,
		initial = {},
	}: { attach: Attachment; renderButton?: boolean; initial?: SwitchRootProps } = $props();

	// svelte-ignore state_referenced_locally
	let spread: SwitchRootProps = $state.raw({ ...initial });

	export function setProps(next: SwitchRootProps) {
		spread = next;
	}
</script>

<label for="reprovided">Label</label>
{#if renderButton}
	<SwitchRoot {...spread} id="reprovided" nativeButton {@attach attach}>
		{#snippet render({ props: elementProps })}
			<button {...elementProps}></button>
		{/snippet}
	</SwitchRoot>
{:else}
	<SwitchRoot {...spread} id="reprovided" {@attach attach} />
{/if}
