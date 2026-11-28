<!--
  A detached trigger whose `render` snippet replaces its host element when "Swap node" is pressed:
  the demo's triggers keep their element.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverHandle,
		PopoverTriggerState,
	} from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let { handle }: { handle: PopoverHandle<number> } = $props();

	let nodeKey = $state("a");
</script>

{#snippet button({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	{#key nodeKey}
		<button {...props}>{@render children?.()}</button>
	{/key}
{/snippet}

<button type="button" onclick={() => (nodeKey = "b")}>Swap node</button>
<Popover.Trigger {handle} id="trigger" payload={1} render={button}>Trigger</Popover.Trigger>
<Popover.Root {handle}>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">Content</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
