// Kernel: what every web part uses: the web platform, `Part`, props merging, attachments, change details, event facts, DOM helpers, tabbability, the text direction and claimed ids.
export { attachmentProps } from "./kernel-attachment-props.js";
export {
	createChangeEventDetails,
	createGenericEventDetails,
	type SohedraChangeEventDetails,
	type SohedraGenericEventDetails,
} from "./kernel-change-details.js";
export { attachClaim, useClaimedId } from "./kernel-claim.svelte.js";
export { DirectionContext } from "./kernel-direction.js";
export {
	getComputedStyle,
	getNodeName,
	getParentNode,
	isElement,
	isHTMLElement,
	isLastTraversableNode,
	isOverflowElement,
	isShadowRoot,
	ownerDocument,
	ownerWindow,
} from "./kernel-dom.js";
export {
	fallbackEvent,
	getInteractionEventType,
	getPointerType,
	isVirtualClick,
	isVirtualPointerEvent,
	makeEventPreventable,
	stopEvent,
} from "./kernel-event.js";
export { enqueueFocus } from "./kernel-focus-queue.js";
export { LTR } from "./kernel-null.js";
export {
	mergeClasses,
	mergeProps,
	mergePropsN,
	mergeStyles,
	type Props,
	type PropsInput,
} from "./kernel-merged-props.js";
export { default as Part } from "./kernel-part.svelte";
export { type WebEvents, webPlatform, webScheduler, type WebTypes } from "./kernel-platform.js";
export { attachRef } from "./kernel-ref.js";
export { activeElement, closest, contains, getTarget } from "./kernel-shadow-dom.js";
export { ssrSafeProps } from "./kernel-ssr-safe-props.js";
export { getStateAttributesProps, type StateAttributesMapping } from "./kernel-state-attributes.js";
export { attachStyle } from "./kernel-style.js";
export { dispatchSyntheticClick } from "./kernel-synthetic-click.js";
export {
	disableFocusInside,
	enableFocusInside,
	focusable,
	type FocusableElement,
	getNextTabbable,
	getPreviousTabbable,
	getTabbableNearElement,
	isElementVisible,
	isOutsideEvent,
	isTabbable,
	isTypeableCombobox,
	tabbable,
	TYPEABLE_SELECTOR,
} from "./kernel-tabbable.js";
export type {
	ClassProp,
	ConstructorOptions,
	NonNativeButtonProps,
	PartUserProps,
	RenderProps,
	RenderSnippetProps,
	SohedraComponentProps,
	StyleProp,
} from "./kernel-types.js";
export { userAgent } from "./kernel-user-agent.js";
export { visuallyHidden, visuallyHiddenInput } from "./kernel-visually-hidden.js";
