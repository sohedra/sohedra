<!-- An open Popover.Root around the `usePositioner` probe (its store is the popup's state). -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { Align, Side } from "#lib/components/popover/popover-types.js";

	import Probe from "./position-anchor-positioning-probe.svelte";

	let { side, align, lazyFlip }: { side?: Side; align?: Align; lazyFlip?: boolean | "placement" } =
		$props();
</script>

<Popover.Root defaultOpen>
	<Probe {side} {align} {lazyFlip} />
</Popover.Root>
