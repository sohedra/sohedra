<!--
  A popover as a page has it, labelled: a "Notifications" trigger in the main landmark under its
  heading, and Backdrop, Positioner and a Popup with every part. The trigger carries
  `data-testid="trigger"` for the server HTML, where no role can find it.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let {
		modal = false,
		openOnHover = false,
		defaultOpen = false,
	}: { modal?: boolean | "trap-focus"; openOnHover?: boolean; defaultOpen?: boolean } = $props();
</script>

<main>
	<h1>Inbox</h1>
	<Popover.Root {modal} {defaultOpen}>
		<Popover.Trigger {openOnHover} delay={0} data-testid="trigger">Notifications</Popover.Trigger>
		<Popover.Portal>
			<Popover.Backdrop />
			<Popover.Positioner>
				<Popover.Popup>
					<Popover.Arrow />
					<Popover.Viewport>
						<Popover.Title>Notifications</Popover.Title>
						<Popover.Description>You are all caught up.</Popover.Description>
						<Popover.Close>Dismiss</Popover.Close>
					</Popover.Viewport>
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
</main>
