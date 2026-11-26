// Kernel: what every web part uses: the web platform, `Part`, props merging, attachments, change details and DOM helpers.
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
