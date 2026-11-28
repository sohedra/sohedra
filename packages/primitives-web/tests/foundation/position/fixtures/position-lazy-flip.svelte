<!--
  Lazy flipping: an open Popover.Root around the `usePositioner` probe, whose store is the popup
  state the probe reads. A Popover's own Positioner fixes `lazyFlip` and gives its popup no way to
  shrink while open, so these cases position a probe of their own.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { Align, Side } from "#lib/components/popover/popover-types.js";

	import Probe from "./position-lazy-flip-probe.svelte";

	let { side, align, lazyFlip }: { side?: Side; align?: Align; lazyFlip?: boolean | "placement" } =
		$props();
</script>

<Popover.Root defaultOpen>
	<Probe {side} {align} {lazyFlip} />
</Popover.Root>
