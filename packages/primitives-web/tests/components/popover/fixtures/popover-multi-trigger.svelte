<!--
  A multi-trigger popover: two `openOnHover` triggers with payloads "One" and "Two" (and
  `pointer-events: none`, so only the dispatched events reach them), and a popup that shows the
  active trigger's payload.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
</script>

<Popover.Root>
	{#snippet children({ payload })}
		<Popover.Trigger payload="One" openOnHover delay={0} closeDelay={0} style="pointer-events: none"
			>One</Popover.Trigger
		>
		<Popover.Trigger payload="Two" openOnHover delay={0} closeDelay={0} style="pointer-events: none"
			>Two</Popover.Trigger
		>
		<Popover.Portal>
			<Popover.Positioner>
				<Popover.Popup>
					<span data-testid="content">{payload as string}</span>
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	{/snippet}
</Popover.Root>
