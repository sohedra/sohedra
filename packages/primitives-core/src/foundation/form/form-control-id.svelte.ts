import { untrack } from "svelte";

import type { LabelableContextValue } from "./form-types.js";

/** What a control's id in its labelable scope reads of the control, from its props function. */
export interface LabelableControlIdProps {
	/**
	 * The control's own `id`. `null` registers no id, so the scope's label omits `for` (a group
	 * named through `aria-labelledby`).
	 */
	readonly id: string | null | undefined;
	/**
	 * Whether the control owns its scope's label association.
	 * @default true
	 */
	readonly enabled?: boolean | undefined;
}

/**
 * A control's id within a labelable scope. The scope's id wins until the control registers its
 * own after mount, so the label's `for` and the control's `id` agree in the server-rendered
 * markup.
 */
export class LabelableControlId {
	readonly #labelable: LabelableContextValue;
	readonly #props: () => LabelableControlIdProps;
	readonly #defaultId: string;
	readonly #source = Symbol();
	#registered = false;
	#hadExplicitId = false;

	readonly #id = $derived.by(() => this.#props().id);
	readonly #enabled = $derived.by(() => this.#props().enabled ?? true);

	/** The id to render on the control. */
	readonly value: string = $derived.by(
		() => (this.#enabled ? this.#labelable.controlId : undefined) ?? this.#id ?? this.#defaultId,
	);

	/** Pure: reads no context. `props` is called inside the deriveds, so each value stays live. */
	constructor(
		labelable: LabelableContextValue,
		props: () => LabelableControlIdProps,
		defaultId: string,
	) {
		this.#labelable = labelable;
		this.#props = props;
		this.#defaultId = defaultId;
	}

	#unregister() {
		if (!this.#registered || this.#labelable.isNull) {
			return;
		}
		this.#registered = false;
		this.#labelable.registerControlId(this.#source, undefined);
	}

	/** Registers the id after mount and on changes. Call once while the control initialises. */
	connect(): void {
		// Registers the control's id with its scope after mount, and again when the id changes.
		$effect(() => {
			const id = this.#id;
			const enabled = this.#enabled;
			untrack(() => {
				if (!enabled || this.#labelable.isNull) {
					this.#unregister();
					return;
				}
				let next: string | null | undefined;
				if (id !== undefined) {
					this.#hadExplicitId = true;
					next = id;
				} else if (this.#hadExplicitId) {
					next = this.#defaultId;
				} else {
					// An id-less replacement claims the scope's fallback, so a previously registered
					// explicit id isn't kept after its control unmounts.
					this.#labelable.resetControlId();
					return;
				}
				this.#registered = true;
				this.#labelable.registerControlId(this.#source, next);
			});
		});
		// The id leaves its scope when the control unmounts.
		$effect(() => () => this.#unregister());
	}
}
