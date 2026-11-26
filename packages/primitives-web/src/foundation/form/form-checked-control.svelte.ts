import {
	ControlLabels,
	type FieldControlLink,
	type FieldRootContextValue,
	LabelableControlId,
	type LabelableContextValue,
} from "@sohedra/primitives-core/foundation/form/index.js";
import { type Bound, REASONS, watch } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { FocusEventHandler, HTMLInputAttributes, MouseEventHandler } from "svelte/elements";
import { on } from "svelte/events";

import { useButton } from "../button/index.js";
import {
	attachmentProps,
	attachRef,
	createChangeEventDetails,
	dispatchClickWithModifiers,
	type Props,
	type SohedraChangeEventDetails,
	visuallyHidden,
	visuallyHiddenInput,
	webScheduler,
	type WebTypes,
} from "../kernel/index.js";
import { LabelableContext, NULL_LABELABLE } from "./form-context.js";
import { attachLabelFallback } from "./form-label-fallback.svelte.js";

/** What the wiring reads of a checked control's store (Switch, Checkbox, Radio). */
export interface CheckedControlView {
	readonly field: FieldRootContextValue<WebTypes>;
	readonly link: FieldControlLink<WebTypes>;
	readonly checked: boolean;
	readonly defaultChecked: boolean;
	readonly disabled: boolean;
	readonly required: boolean;
	/** Whether the user may change the control. */
	readonly interactive: boolean;
	/** The name the hidden input submits under. */
	readonly name: string | undefined;
	/** Proposes a checked state; `false` when it was refused, canceled or declined. */
	setChecked(next: boolean, details: SohedraChangeEventDetails<typeof REASONS.none>): boolean;
	/** A form reset: back to the default without the change callback. */
	reset(): boolean;
	/** The control lost focus. */
	focusOut(): void;
}

/** What the part tells `useCheckedControl`, from its props function. */
export interface CheckedControlOptions {
	/** The hidden input's type. */
	readonly type: "checkbox" | "radio";
	/** The `id` prop. */
	readonly id: string | undefined;
	/**
	 * The hidden input's id when neither the prop nor a Field gives one. Fixed for the control's
	 * life (`$props.id()`): read once, when the wiring is called.
	 */
	readonly inputId: string;
	/** The visible element's id when it is not the labelable control. */
	readonly rootId: string;
	/** Whether the visible element is a native button, and so the labelable control itself. */
	readonly native: boolean;
	/** The `form` prop: the form that owns the hidden input. */
	readonly form: string | undefined;
	/** What the hidden input submits while checked: the `value` prop. */
	readonly value: string | undefined;
	/** The value a form gets while the control is off: the `uncheckedValue` prop. */
	readonly uncheckedValue?: string | undefined;
	/** The user's own `aria-labelledby`. */
	readonly labelledBy: string | null | undefined;
	/** The user's own `aria-label`. A non-blank one wins over associated labels. */
	readonly label: string | null | undefined;
	/** The `inputRef` binding. */
	readonly inputRef: Bound<HTMLInputElement | null | undefined>;
}

/** What `useCheckedControl` returns. */
export interface CheckedControl {
	/**
	 * The visible element's id: the labelable control's when it is a native button, else
	 * `rootId`. A value, not a prop inside `props`, so the part writes it where the server HTML
	 * has it: before the part's own attributes.
	 */
	readonly id: string;
	/**
	 * For the visible element: its `aria-labelledby`, the press, focus and blur handlers, and, as
	 * attachments inside, its place in its field (the element a form focuses).
	 */
	readonly props: Props;
	/** For `Part`'s `after`: button semantics, then the field's descriptions and `aria-invalid`. */
	readonly after: (merged: Props) => Props;
	/** The hidden input that holds the value for forms and native labels. */
	readonly hidden: HTMLInputAttributes;
	/** The input that submits `uncheckedValue` while the control is off. */
	readonly unchecked: HTMLInputAttributes;
}

/**
 * A control whose value is a checked state (Switch, Checkbox, Radio): its place in its field, its
 * labelling, the hidden input beside it and the forwarding of a press to that input, focus and
 * blur, and button semantics. Call it once while the part initialises: it reads the labelable
 * context and registers the control's id.
 *
 * The hidden input is a props object, not a component: a component beside the part's element
 * adds a hydration marker to the server HTML.
 */
export function useCheckedControl(
	store: CheckedControlView,
	options: () => CheckedControlOptions,
): CheckedControl {
	const field = store.field;
	const labelable = LabelableContext.getOr(NULL_LABELABLE);

	const controlId = new LabelableControlId(
		labelable,
		() => ({ id: options().id }),
		untrack(options).inputId,
	);
	const labels = new ControlLabels(() => {
		const { labelledBy, label, native } = options();
		return {
			explicit: labelledBy ?? undefined,
			labelId: labelable.labelId,
			ariaLabel: label ?? undefined,
			enableFallback: !native,
			sourceId: native ? undefined : controlId.value,
		};
	});
	controlId.connect();

	const button = useButton(() => ({ disabled: store.disabled, native: options().native }));
	const validation = fieldValidationProps(field, labelable, store);

	// The elements, for the handlers: the visible one takes the focus the input gets, and a press on
	// the visible one is forwarded to the input.
	let root: HTMLElement | null = null;
	let input: HTMLInputElement | null = null;

	const onclick: MouseEventHandler<HTMLElement> = (event) => {
		if (!store.interactive) {
			return;
		}
		// Keeps a wrapping <label> from clicking the input a second time.
		event.preventDefault();
		if (input) {
			dispatchClickWithModifiers(input, event);
		}
	};
	const onfocus: FocusEventHandler<HTMLElement> = () => store.link.focus();
	const onblur: FocusEventHandler<HTMLElement> = () => store.focusOut();

	const rootAttachments = attachmentProps(
		attachRef<HTMLElement>((element) => (root = element)),
		attachFocusTarget(store.link),
	);
	const inputAttachments = attachmentProps(
		attachRef<HTMLInputElement>((element) => (input = element)),
		attachRef<HTMLInputElement>(
			(element) => (options().inputRef.value = element),
			() => options().inputRef.value,
		),
		attachCheckedInput(store, () => root),
		attachLabelFallback(labels),
		attachFieldInput(field, store.link),
	);

	return {
		get id() {
			return options().native ? controlId.value : options().rootId;
		},
		get props() {
			return { "aria-labelledby": labels.value, onclick, onfocus, onblur, ...rootAttachments };
		},
		after: (merged) => validation(button.after(merged)),
		get hidden(): HTMLInputAttributes {
			const { type, form, native, value } = options();
			const name = store.name;
			return {
				...validation({}),
				type,
				checked: store.checked,
				disabled: store.disabled,
				form,
				id: native ? undefined : controlId.value,
				name,
				required: store.required,
				style: name ? visuallyHiddenInput : visuallyHidden,
				tabindex: -1,
				"aria-hidden": "true",
				// Only when given: a `value` property set to "" would submit "" instead of "on".
				...(value !== undefined ? { value } : undefined),
				...inputAttachments,
			};
		},
		get unchecked(): HTMLInputAttributes {
			const { form, uncheckedValue } = options();
			return {
				type: "hidden",
				form,
				name: store.name,
				value: uncheckedValue,
				disabled: store.disabled,
			};
		},
	};
}

/**
 * The element a form focuses: it becomes the field's control element, and holds the field's
 * focused state while it is focused and enabled. Disabling or unmounting a focused control moves
 * focus away without a `blur`, so the attachment lets go of the focused state then, and claims it
 * at mount for a control focused before hydration (autofocus).
 */
function attachFocusTarget(link: FieldControlLink<WebTypes>): Attachment<HTMLElement> {
	return (element) => {
		const releaseElement = link.attachElement(element);
		// Holds the field's focused state for the focused element while it is enabled.
		watch(
			() => link.disabled,
			() => {
				const root = element.getRootNode() as Document | ShadowRoot;
				if (root.activeElement === element) {
					link.focus();
				}
				return link.releaseFocus;
			},
			{ lazy: false },
		);
		return releaseElement;
	};
}

/** Registers the hidden input with the field, for its native validity. */
function attachFieldInput(
	field: FieldRootContextValue<WebTypes>,
	link: FieldControlLink<WebTypes>,
): Attachment<HTMLInputElement> {
	// A `render` snippet may render an element without constraint validation (a `<div>`).
	return (element) =>
		"validity" in element && "willValidate" in element
			? field.registerInput(link, element)
			: undefined;
}

/**
 * The end of a field control's merge chain: `aria-describedby` with the field's description and
 * error ids after the user's own, and `aria-invalid` while the field is invalid and neither it nor
 * the control is disabled.
 */
function fieldValidationProps(
	field: FieldRootContextValue<WebTypes>,
	labelable: LabelableContextValue,
	control: { readonly disabled: boolean },
): (props: Props) => Props {
	return (props) => {
		const next: Props = {
			...props,
			"aria-describedby": labelable.describedBy(props["aria-describedby"] as string | undefined),
		};
		if (field.state.valid === false && !field.state.disabled && !control.disabled) {
			next["aria-invalid"] = true;
		}
		return next;
	};
}

/**
 * The hidden input's behaviour. User changes arrive as clicks on it (the visible control forwards
 * its clicks, and native labels click it): the browser toggles it first, then the store decides,
 * and a click it refuses is canceled, which reverts the input and suppresses its `input` and
 * `change` events. A form reset restores the default.
 */
function attachCheckedInput(
	store: CheckedControlView,
	getFocusTarget: () => HTMLElement | null,
): Attachment<HTMLInputElement> {
	return (input) => {
		// Keeps the native default in step, so the browser's own reset restores it synchronously
		// and FormData is right as soon as `form.reset()` returns.
		$effect(() => {
			input.defaultChecked = store.defaultChecked;
			input.checked = untrack(() => store.checked);
		});

		const offClick = on(input, "click", (event) => {
			// A click canceled before it reached the input.
			if (event.defaultPrevented) {
				return;
			}
			// The click dispatched from the visible control is an implementation detail and must not
			// reach ancestors, which already received the original click.
			event.stopPropagation();
			const details = createChangeEventDetails(REASONS.none, event);
			if (!store.setChecked(input.checked, details)) {
				// Canceling reverts the native toggle only when the event is cancelable, so the input is
				// also set back to the store's value.
				event.preventDefault();
				input.checked = untrack(() => store.checked);
			}
		});

		const offFocus = on(input, "focus", () => {
			getFocusTarget()?.focus();
		});

		const offReset = onFormReset(input, () => {
			store.reset();
			// A function binding may have declined the reset; the input follows the store.
			input.checked = untrack(() => store.checked);
		});

		return () => {
			offClick();
			offFocus();
			offReset();
		};
	};
}

/**
 * Calls `onReset` when the form `control` belongs to is natively reset, so the control can restore
 * its default without its change callback. Returns the cleanup.
 *
 * The `reset` event fires before the browser resets the controls, and a later listener may still
 * cancel it, so `onReset` runs a task after the event, and only if the reset wasn't prevented.
 * (Not a microtask: after a trusted click on a reset button, microtasks run between the reset
 * event and the browser's reset of the controls.) `reset` isn't composed, so the listener sits on
 * the control's own tree (its document or shadow root), which holds the form it belongs to.
 */
function onFormReset(control: HTMLInputElement, onReset: () => void): () => void {
	let cancelPending: (() => void) | undefined;
	const off = on(
		control.getRootNode() as Document | ShadowRoot,
		"reset",
		(event) => {
			const form = control.form;
			if (form === null || event.target !== form) {
				return;
			}
			cancelPending?.();
			cancelPending = webScheduler.timeout(() => {
				cancelPending = undefined;
				if (!event.defaultPrevented) {
					onReset();
				}
			}, 0);
		},
		{ capture: true },
	);
	return () => {
		off();
		cancelPending?.();
		cancelPending = undefined;
	};
}
