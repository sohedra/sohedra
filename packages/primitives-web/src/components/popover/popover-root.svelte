<!--
  @component
  Groups all parts of the popover. Doesn't render its own HTML element.

  Close or unmount it imperatively with `bind:this` and `close()` / `unmount()`.
-->
<script lang="ts" generics="Payload = unknown">
	import { bound, REASONS, sohedraId } from "@sohedra/primitives-core/foundation/kernel";
	import { PopoverStore } from "@sohedra/primitives-core/popover";

	import {
		createChangeEventDetails,
		fallbackEvent,
		type WebTypes,
	} from "../../foundation/kernel/index.js";
	import { usePopupRootDeps, usePopupRoot } from "../../foundation/popup/index.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverRootProps } from "./popover-types.js";

	// 1. Props
	let {
		open = $bindable(),
		defaultOpen,
		onOpenChange,
		onOpenChangeComplete,
		modal,
		handle,
		triggerId,
		defaultTriggerId,
		children,
	}: PopoverRootProps<Payload> = $props();

	const uid = $props.id();

	// 2. Store and context
	const popover = new PopoverStore<Payload, WebTypes>(
		() => ({
			defaultOpen,
			triggerId,
			defaultTriggerId,
			onOpenChange,
			onOpenChangeComplete,
			modal,
			handle,
		}),
		{
			open: bound(
				() => open,
				(next) => (open = next),
			),
			...usePopupRootDeps(sohedraId(uid)),
		},
	);
	popover.connect();
	// A context holds one store whatever its payload type, so readers see the payload as unknown.
	PopoverRootContext.set(popover as PopoverStore<unknown, WebTypes>);

	// 3. Shared behaviours
	usePopupRoot(popover);

	// 4. Own wiring
	/** Closes the popover. */
	export function close(): void {
		popover.close(createChangeEventDetails(REASONS.imperativeAction, fallbackEvent()));
	}

	/**
	 * Ends the closing phase after an externally controlled closing animation finishes. Call
	 * `preventUnmountOnClose()` in `onOpenChange` first.
	 */
	export function unmount(): void {
		popover.unmount();
	}
</script>

{@render children?.({ payload: popover.payload })}
