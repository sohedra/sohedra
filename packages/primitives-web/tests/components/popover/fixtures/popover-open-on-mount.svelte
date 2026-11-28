<!--
  A Root on a handle whose descendant opens it by trigger id from an effect on mount, which the demo
  cannot do: nothing in it runs on mount.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle } from "#lib/components/popover/popover-types.js";

	import ConformanceRunEffect from "../../../conformance/fixtures/conformance-run-effect.svelte";

	let { handle }: { handle: PopoverHandle } = $props();
</script>

<Popover.Root {handle}>
	<Popover.Trigger id="trigger">Trigger</Popover.Trigger>
	<ConformanceRunEffect run={() => handle.open("trigger")} />
</Popover.Root>
