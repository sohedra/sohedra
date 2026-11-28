<!--
  @component
  A portal element that moves the popup to a different part of the DOM. By default, the portal
  element is appended to `<body>`. Renders a `<div>` element.
-->
<script lang="ts">
	import { sohedraId } from "@sohedra/primitives-core/foundation/kernel";
	import { PopupPortalStore } from "@sohedra/primitives-core/foundation/popup";

	import { useAncestorsInsideMarker } from "../../foundation/dismiss/index.js";
	import type { WebTypes } from "../../foundation/kernel/index.js";
	import { PopupPortal } from "../../foundation/portal/index.js";
	import { PopoverPortalContext, PopoverRootContext } from "./popover-context.js";
	import type { PopoverPortalProps } from "./popover-types.js";

	// 1. Props
	let {
		keepMounted = false,
		container,
		ref = $bindable(null),
		...rest
	}: PopoverPortalProps = $props();

	const uid = $props.id();

	// 2. Store and context
	const popover = PopoverRootContext.get("Popover.Portal");
	const portal = new PopupPortalStore<WebTypes>(() => ({ keepMounted }), { popup: popover });
	PopoverPortalContext.set(portal);

	// 3. Shared behaviours
	// A press anywhere in the portal is inside the popups this one is nested in.
	const inside = useAncestorsInsideMarker(popover);
</script>

<PopupPortal
	bind:ref
	state={portal.state}
	mounted={portal.mounted}
	{container}
	id={sohedraId(uid)}
	inside={inside.props}
	user={rest}
/>
