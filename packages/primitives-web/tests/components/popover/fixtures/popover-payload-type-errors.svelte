<!--
  A type test, checked by `pnpm check` and never rendered: each `@ts-expect-error` must match an
  error, so a payload that stops being typed fails the check. The `children` payload is checked
  in popover-payload-types.svelte.
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
