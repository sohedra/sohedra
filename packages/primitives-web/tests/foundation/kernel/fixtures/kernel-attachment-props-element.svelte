<!--
  A `<div>` spread with props a wiring builds again on every change of `label`, carrying one
  attachment under a key made once.
-->
<script lang="ts">
	import { untrack } from "svelte";

	import { attachmentProps } from "#lib/foundation/kernel/index.js";

	let { label, onattach, ondetach }: { label: string; onattach: () => void; ondetach: () => void } =
		$props();

	// Untracked, so the attachment runs again only if its key changes, never for what it reads.
	const attached = attachmentProps(() => {
		untrack(() => onattach());
		return () => untrack(() => ondetach());
	});
	const elementProps = $derived({ "aria-label": label, ...attached });
</script>

<div data-testid="element" {...elementProps}></div>
