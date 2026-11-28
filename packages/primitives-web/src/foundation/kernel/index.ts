// Kernel: what every web part uses: the web platform, `Part`, props merging, attachments, change details, event facts, DOM helpers, tabbability, the text direction and claimed ids.
export { type WebEvents, type WebTypes, webPlatform, webScheduler } from "./kernel-platform.js";

export { attachRef } from "./kernel-ref.js";
export { attachmentProps } from "./kernel-attachment-props.js";
export {
	makeEventPreventable,
	mergeProps,
	mergePropsN,
	type Props,
	type PropsInput,
} from "./kernel-merged-props.js";
export { default as Part } from "./kernel-part.svelte";
export { getStateAttributesProps, type StateAttributesMapping } from "./kernel-state-attributes.js";
export type {
	ClassProp,
	NonNativeButtonProps,
	PartUserProps,
	RenderProps,
	RenderSnippetProps,
	SohedraComponentProps,
	StyleProp,
} from "./kernel-types.js";
export { visuallyHidden, visuallyHiddenInput } from "./kernel-visually-hidden.js";

export { dispatchClickWithModifiers } from "./kernel-synthetic-click.js";
export { isHTMLElement, ownerDocument, ownerWindow } from "./kernel-dom.js";

export {
	createChangeEventDetails,
	createGenericEventDetails,
	type SohedraChangeEventDetails,
	type SohedraGenericEventDetails,
} from "./kernel-change-details.js";
export { attachClaim } from "./kernel-claim.svelte.js";
export { DirectionContext, LTR } from "./kernel-direction.js";
export {
	getComputedStyle,
	getNodeName,
	getParentNode,
	isElement,
	isLastTraversableNode,
	isOverflowElement,
	isShadowRoot,
} from "./kernel-dom.js";
export {
	fallbackEvent,
	getInteractionEventType,
	getPointerType,
	isVirtualClick,
	isVirtualPointerEvent,
	stopEvent,
} from "./kernel-event.js";
export { mergeStyles } from "./kernel-merged-props.js";
export { activeElement, closest, contains, getTarget } from "./kernel-shadow-dom.js";
export type { ConstructorOptions } from "./kernel-types.js";
export { userAgent } from "./kernel-user-agent.js";
export { enqueueFocus } from "./kernel-focus-queue.js";
export { mergeClasses } from "./kernel-merged-props.js";
export { ssrSafeProps } from "./kernel-ssr-safe-props.js";
export { attachStyle } from "./kernel-style.js";
export {
	type FocusableElement,
	TYPEABLE_SELECTOR,
	disableFocusInside,
	enableFocusInside,
	focusable,
	getNextTabbable,
	getPreviousTabbable,
	getTabbableNearElement,
	isElementVisible,
	isOutsideEvent,
	isTabbable,
	isTypeableCombobox,
	tabbable,
} from "./kernel-tabbable.js";
export { useClaimedId } from "./kernel-claim.svelte.js";
