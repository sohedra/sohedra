<!--
  @component
  A paragraph with additional information about the popover. Renders a `<p>` element.
-->
<script lang="ts">
	import { sohedraId } from "@sohedra/primitives-core/foundation/kernel";

	import { Part, useClaimedId } from "../../foundation/kernel/index.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverDescriptionProps } from "./popover-types.js";

	// 1. Props
	let { id, ref = $bindable(null), ...rest }: PopoverDescriptionProps = $props();

	const uid = $props.id();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Description");

	// 3. Shared behaviours
	// The popup's `aria-describedby` names this id while the element is in the document: claimed in
	// effect timing, so the attribute appears after hydration, and not while the part is still
	// loading offscreen.
	const claimed = useClaimedId(popover.descriptionId, () => ({ id }), {
		defaultId: sohedraId(uid),
	});
</script>

<Part tag="p" bind:ref state={popover.descriptionState} {...claimed.props} user={rest} />
