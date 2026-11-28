import type { PlatformTypes } from "../../foundation/kernel/index.js";
import { detachedPopupDeps, PopupHandle } from "../../foundation/popup/index.js";
import { PopoverStore, type PopoverStoreProps } from "./popover-store.svelte.js";

/** The inert store a handle exposes while no Popover.Root is attached: it never opens. */
function createDetachedPopoverStore<Payload>(): PopoverStore<Payload> {
	// The props of a store no Popover.Root gave any.
	const props: PopoverStoreProps<Payload, PlatformTypes> = {
		defaultOpen: false,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		modal: undefined,
	};
	return new PopoverStore<Payload>(() => props, detachedPopupDeps());
}

/**
 * Controls a Popover imperatively and associates detached `Popover.Trigger` components with a
 * `Popover.Root`. Create one with `Popover.createHandle()` and pass it to the `handle` prop of the
 * root and of any triggers rendered outside of it. The imperative methods take effect only while
 * a root using this handle is mounted.
 */
export class PopoverHandle<Payload = unknown> extends PopupHandle<PopoverStore<Payload>> {
	constructor() {
		super({ fallback: createDetachedPopoverStore<Payload>(), name: "Popover" });
	}

	/**
	 * Opens the popover and associates it with the trigger with the given id. Call it from an event
	 * handler or an effect.
	 */
	open(triggerId: string): void {
		this.openByTrigger(triggerId);
	}

	/** Closes the popover. Call it from an event handler or an effect. */
	close(): void {
		this.closePopup();
	}

	/** Whether the popover is currently open; `false` while no root is attached. */
	get isOpen(): boolean {
		return this.attachedStore?.open ?? false;
	}
}

/** Creates a new handle to connect a Popover.Root with detached Popover.Trigger components. */
export function createPopoverHandle<Payload = unknown>(): PopoverHandle<Payload> {
	return new PopoverHandle<Payload>();
}
