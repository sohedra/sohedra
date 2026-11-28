<!--
  @component
  A heading that labels the popover. Renders an `<h2>` element.
-->
<script lang="ts">
	import { sohedraId } from "@sohedra/primitives-core/foundation/kernel";

	import { Part, useClaimedId } from "../../foundation/kernel/index.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverTitleProps } from "./popover-types.js";

	// 1. Props
	let { id, ref = $bindable(null), ...rest }: PopoverTitleProps = $props();

	const uid = $props.id();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Title");

	// 3. Shared behaviours
	// The popup's `aria-labelledby` names this id while the element is in the document: claimed in
	// effect timing, so the attribute appears after hydration, and not while the part is still
	// loading offscreen.
	const claimed = useClaimedId(popover.titleId, () => ({ id }), { defaultId: sohedraId(uid) });
</script>

<Part tag="h2" bind:ref state={popover.titleState} {...claimed.props} user={rest} />
