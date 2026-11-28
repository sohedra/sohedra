<!--
  @component
  A button that opens the popover. Renders a `<button>` element.
-->
<script lang="ts" generics="Payload = unknown">
	import { OPEN_DELAY } from "@sohedra/primitives-core/components/popover/index.js";
	import { REASONS, sohedraId } from "@sohedra/primitives-core/foundation/kernel/index.js";
	import { PopupTriggerStore } from "@sohedra/primitives-core/foundation/popup/index.js";
	import type { MouseEventHandler } from "svelte/elements";

	import { useButton } from "../../foundation/button/index.js";
	import {
		createChangeEventDetails,
		getInteractionEventType,
		mergePropsN,
		Part,
		type WebTypes,
	} from "../../foundation/kernel/index.js";
	import {
		popupTriggerStateMapping,
		pressedPopupTriggerStateMapping,
		usePopupTrigger,
	} from "../../foundation/popup/index.js";
	import { PopoverRootContext } from "./popover-context.js";
	import type { PopoverTriggerProps } from "./popover-types.js";

	// 1. Props
	let {
		handle,
		payload,
		openOnHover = false,
		delay = OPEN_DELAY,
		closeDelay = 0,
		disabled = false,
		nativeButton = true,
		id: idProp,
		ref = $bindable(null),
		...rest
	}: PopoverTriggerProps<Payload> = $props();

	const uid = $props.id();
	const id = $derived(idProp ?? sohedraId(uid));

	// 2. Store and context
	const root = PopoverRootContext.getOr(null);

	// 3. Shared behaviours
	// The trigger's popover is its handle's while it has one, else its Root's.
	const trigger = usePopupTrigger(
		root,
		() => ({
			handle,
			id,
			disabled,
			data: { payload, disabled, openOnHover, closeDelay },
			hover: { openOnHover, delay, closeDelay },
		}),
		{ part: "Popover.Trigger" },
	);
	const popover = $derived(trigger.popup);
	// The trigger's state, and whether a press of it opened the popover.
	const triggerState = new PopupTriggerStore<WebTypes>(() => ({ popup: popover, id, disabled }));
	const button = useButton(() => ({
		disabled,
		native: nativeButton,
		composite: trigger.inComposite,
	}));

	// 4. Own wiring
	// A press opens the popover, closes it from the trigger that owns it, or pins a hovered one.
	const onclick: MouseEventHandler<HTMLElement> = (event) => {
		popover.pressTrigger(
			event.currentTarget,
			createChangeEventDetails(REASONS.triggerPress, event, event.currentTarget),
			{ keyboardClick: event.detail === 0, eventType: getInteractionEventType(event) },
		);
	};

	// The press and the shared behaviour handle the same events, so they are merged here, in this
	// order; `Part` merges the user's props over them.
	const own = $derived(mergePropsN([{ onclick }, trigger.props]));
</script>

<!-- No whitespace between the elements: it would render text beside the trigger. -->
{#if trigger.guarded}<span {...trigger.guardBefore}></span>{/if}<Part
	tag="button"
	bind:ref
	state={triggerState.state}
	attrs={triggerState.pressed ? pressedPopupTriggerStateMapping : popupTriggerStateMapping}
	{...own}
	{id}
	aria-haspopup="dialog"
	aria-expanded={popover.activeTrigger.isOpenedBy(id)}
	aria-controls={popover.triggerPopupId(id)}
	user={rest}
	after={button.after}
/>{#if trigger.guarded}<span {...trigger.guardAfter}></span>{/if}
