/** What a control's labels read of the control, from its props function. */
export interface ControlLabelsProps {
	/** The control's own `aria-labelledby`. */
	readonly explicit: string | undefined;
	/** The id of a `Field.Label`, when the control is in a labelable scope. */
	readonly labelId: string | undefined;
	/** The control's own label text (web: `aria-label`). A non-blank one wins over associated labels. */
	readonly label: string | undefined;
	/** Whether to fall back to a native `<label>` associated with `sourceId`'s element. */
	readonly enableFallback: boolean;
	/** The id of the element native labels associate with (a hidden input). */
	readonly sourceId: string | undefined;
}

/**
 * A control's `aria-labelledby`: its own, the labelable scope's label, or a native `<label>`
 * associated with its hidden input. Finding that label is the platform's work: it reads
 * `fallbackLabelId` (the id to give the label when it has none) and reports the label's id with
 * `setFallback`.
 */
export class ControlLabels {
	readonly #props: () => ControlLabelsProps;

	/** The associated native label's id, found by the platform. */
	#fallback: string | undefined = $state();

	readonly #hasLabel = $derived.by(() => Boolean(this.#props().label?.trim()));

	/** The id for an associated label that has none, or `undefined` when no fallback is wanted. */
	readonly fallbackLabelId: string | undefined = $derived.by(() => {
		const props = this.#props();
		return props.explicit ||
			props.labelId ||
			this.#hasLabel ||
			!props.enableFallback ||
			!props.sourceId
			? undefined
			: `${props.sourceId}-label`;
	});

	/** The control's `aria-labelledby`. */
	readonly value: string | undefined = $derived.by(() => {
		const props = this.#props();
		return (
			props.explicit ??
			(this.#hasLabel ? undefined : props.labelId) ??
			(this.fallbackLabelId === undefined ? undefined : this.#fallback)
		);
	});

	/** Pure: reads no context. `props` is called inside the deriveds, so each value stays live. */
	constructor(props: () => ControlLabelsProps) {
		this.#props = props;
	}

	/** The platform found the associated native label's id (`undefined`: none, or none wanted). */
	setFallback = (id: string | undefined): void => {
		this.#fallback = id;
	};
}
