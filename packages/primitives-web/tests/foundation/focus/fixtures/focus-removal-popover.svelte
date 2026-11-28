<!--
  A click-opened Popover whose popup holds a `remove` button, which takes focus when the popover
  opens, and an `other` button after it. `removeFocused()` takes the `remove` button out of the
  popup, as an app does with a control that is no longer needed.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let shown = $state(true);

	export function removeFocused() {
		shown = false;
	}
</script>

<Popover.Root>
	<Popover.Trigger data-testid="anchor">anchor</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">
				{#if shown}<button data-testid="remove">remove</button>{/if}
				<button data-testid="other">other</button>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
