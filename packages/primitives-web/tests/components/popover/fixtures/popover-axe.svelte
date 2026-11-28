<!-- A popover as a page renders it, for the axe checks: trigger, backdrop, positioner, popup with
  arrow, viewport, title, description and close. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let {
		modal = false,
		openOnHover = false,
	}: { modal?: boolean | "trap-focus"; openOnHover?: boolean } = $props();
</script>

<main>
	<h1>Inbox</h1>
	<Popover.Root {modal}>
		<Popover.Trigger {openOnHover} delay={0}>Notifications</Popover.Trigger>
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
