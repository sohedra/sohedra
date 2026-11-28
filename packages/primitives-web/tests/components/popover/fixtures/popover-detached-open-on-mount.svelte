<!-- A Root with a contained trigger and a descendant that opens the handle from an effect on mount. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	import PopupRunEffect from "../../../conformance/popup-run-effect.svelte";

	let { handle }: { handle: PopoverHandle } = $props();
</script>

<Popover.Root {handle}>
	<Popover.Trigger id="trigger">Trigger</Popover.Trigger>
	<PopupRunEffect run={() => handle.open("trigger")} />
</Popover.Root>
