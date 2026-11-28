<!--
  Two detached hover triggers rendered through a `render` snippet (the demo renders its triggers
  as they are), with a close delay, so moving between them hands the popup off instead of closing
  it. The popup shows the active trigger's payload.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverHandle,
		PopoverTriggerState,
	} from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let { handle }: { handle: PopoverHandle<number> } = $props();
</script>

{#snippet button({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	<button {...props}>{@render children?.()}</button>
{/snippet}

{#each [1, 2] as payload (payload)}
	<Popover.Trigger
		{handle}
		id={`trigger-${payload}`}
		{payload}
		openOnHover
		delay={0}
		closeDelay={100}
		render={button}>Trigger {payload}</Popover.Trigger
	>
{/each}
<Popover.Root {handle}>
	{#snippet children({ payload })}
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup">{payload}</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	{/snippet}
</Popover.Root>
