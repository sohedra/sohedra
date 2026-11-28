import { type Attachment, createAttachmentKey } from "svelte/attachments";

/**
 * Props that carry `attachments` under keys made here, once: a wiring makes them while it
 * initialises and spreads them into its props. A key made on each read would make Svelte detach
 * and attach again every time. Typed by their element, so they spread onto a plain element too.
 */
export function attachmentProps<E extends Element = Element>(
	...attachments: readonly Attachment<E>[]
): { readonly [key: symbol]: Attachment<E> } {
	const props: { [key: symbol]: Attachment<E> } = {};
	for (const attachment of attachments) {
		props[createAttachmentKey()] = attachment;
	}
	return props;
}
