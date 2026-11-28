// The base of every popup's handle: a Root's store attached from outside it, the triggers rendered
// outside the Root, and the imperative open and close.

import { DEV } from "esm-env";

import { bound, inertPlatform, type Platform, type PlatformTypes } from "../kernel/index.js";
import type { PopupStoreDeps } from "./popup-store.svelte.js";
import type { PopupTriggerMap } from "./popup-trigger-map.js";

// A handle warns on every ignored call, not once per message as `warn` does.
function warnEveryTime(...messages: string[]) {
	if (DEV) {
		console.warn(`Sohedra: ${messages.join(" ")}`);
	}
}

/**
 * The deps of the inert store a handle exposes while no Root is attached: it never opens, has no
 * tree and runs on the inert platform. A kind's handle builds its own store class with these.
 */
export function detachedPopupDeps(): PopupStoreDeps<PlatformTypes> {
	return {
		open: bound(
			() => false,
			() => {},
		),
		defaultPopupId: "",
		tree: null,
		nested: false,
		platform: inertPlatform,
		detached: true,
	};
}

/** What a handle needs from a Root's store. */
export interface HandleAttachableStore {
	readonly triggers: PopupTriggerMap;
	readonly open: boolean;
	/** The store's platform: an attached Root's, or the inert one of a detached store. */
	readonly platform: Pick<Platform, "scheduler">;
	/**
	 * Opens or closes imperatively. `event` is the platform's event for a change with no native
	 * one; `trigger` is the element to associate, if any.
	 */
	openImperatively(
		open: boolean,
		event: unknown,
		trigger: object | undefined,
		triggerId?: string,
	): void;
}

/** What a handle is given once. */
export interface PopupHandleDeps<Store> {
	/** The inert store detached triggers read while no Root is attached. */
	readonly fallback: Store;
	/** The component name in warnings, e.g. `Popover`. */
	readonly name: string;
	/** Whether opening by an unregistered trigger id throws (an anchored popup needs one). */
	readonly throwOnMissingTrigger?: boolean | undefined;
}

interface Attachment<Store> {
	readonly store: Store;
	/** The platform's event for an imperative change (a handle call runs no platform code). */
	readonly imperativeEvent: () => unknown;
}

/**
 * Connects a Root with triggers rendered outside it and opens or closes it imperatively. Its
 * constructor is pure, so handles can be created at module scope. Detached triggers read
 * {@link store}: the attached Root's store, or an inert fallback while no Root is attached.
 */
export class PopupHandle<Store extends HandleAttachableStore> {
	readonly #fallback: Store;
	readonly #name: string;
	readonly #throwOnMissingTrigger: boolean;
	readonly #attachments: Attachment<Store>[] = [];
	#attached: Attachment<Store> | null = $state.raw(null);

	constructor(deps: PopupHandleDeps<Store>) {
		this.#fallback = deps.fallback;
		this.#name = deps.name;
		this.#throwOnMissingTrigger = deps.throwOnMissingTrigger ?? true;
	}

	/** The attached Root's store, or the fallback store. Reactive. */
	get store(): Store {
		return this.#attached?.store ?? this.#fallback;
	}

	protected get attachedStore(): Store | null {
		return this.#attached?.store ?? null;
	}

	/**
	 * Attaches a Root's store; the newest attached store takes over. `imperativeEvent` makes the
	 * event of the changes this handle requests: the Root's platform passes it, since a
	 * handle call runs no platform code. Returns the detachment, which hands control back to the
	 * newest store still attached.
	 */
	attachStore = (store: Store, imperativeEvent: () => unknown): (() => void) => {
		const attachment: Attachment<Store> = { store, imperativeEvent };
		this.#attachments.push(attachment);
		this.#attached = attachment;
		if (DEV && this.#attachments.length > 1) {
			// An overlap is usually a transient route transition; warn only if it outlives a frame.
			store.platform.scheduler.frame(() => {
				if (this.#attachments.length > 1) {
					warnEveryTime(
						"A handle is attached to more than one mounted root at the same time.",
						"The most recently mounted root takes over and the previous one stops being controlled by the handle.",
						"A handle should be used by a single root that stays mounted for the lifetime of the handle.",
					);
				}
			});
		}
		return () => {
			const index = this.#attachments.lastIndexOf(attachment);
			if (index !== -1) {
				this.#attachments.splice(index, 1);
			}
			this.#attached = this.#attachments[this.#attachments.length - 1] ?? null;
		};
	};

	protected openByTrigger(triggerId: string | null | undefined): void {
		const attached = this.#attached;
		if (attached === null) {
			warnEveryTime(
				`${this.#name}Handle.open() was called while no root using this handle is mounted.`,
				"The call was ignored; mount a root with this handle before opening it imperatively.",
			);
			return;
		}
		// During a transient overlap a trigger may still be registered with an older root or the
		// fallback store, so search them all, newest first.
		let trigger: object | undefined;
		if (triggerId) {
			for (let i = this.#attachments.length - 1; i >= 0 && !trigger; i -= 1) {
				trigger = this.#attachments[i].store.triggers.getById(triggerId);
			}
			trigger ??= this.#fallback.triggers.getById(triggerId);
		}
		if (triggerId && !trigger) {
			if (this.#throwOnMissingTrigger) {
				throw new Error(
					`Sohedra: ${this.#name}Handle.open() was called with the trigger id "${triggerId}", ` +
						"but no matching trigger is registered with this handle. " +
						"An anchored popup cannot open without a trigger to anchor to. " +
						`Pass the id of a mounted ${this.#name}.Trigger that has this handle set on its "handle" prop.`,
				);
			}
			warnEveryTime(
				`${this.#name}Handle.open: No trigger found with id "${triggerId}".`,
				"The popup will open, but the trigger will not be associated with it.",
			);
		}
		attached.store.openImperatively(
			true,
			attached.imperativeEvent(),
			trigger,
			trigger ? (triggerId ?? undefined) : undefined,
		);
	}

	protected closePopup(): void {
		const attached = this.#attached;
		if (attached === null) {
			warnEveryTime(
				`${this.#name}Handle.close() was called while no root using this handle is mounted.`,
				"The call was ignored.",
			);
			return;
		}
		attached.store.openImperatively(false, attached.imperativeEvent(), undefined);
	}
}
