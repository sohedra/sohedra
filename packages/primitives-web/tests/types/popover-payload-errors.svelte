<!--
  Type test (checked by `pnpm check`, never rendered): each `@ts-expect-error` must match an error,
  so a trigger payload that stops being typed fails the check. The `children` snippet's payload is
  checked in popover-payload.svelte, where a payload typed `unknown` or `{}` has no `text`.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	const handle = Popover.createHandle<{ text: string }>();
</script>

<Popover.Trigger
	{handle}
	payload={{
		// @ts-expect-error `title` isn't a property of the handle's payload.
		title: "Trigger 1",
	}}
>
	Trigger 1
</Popover.Trigger>
