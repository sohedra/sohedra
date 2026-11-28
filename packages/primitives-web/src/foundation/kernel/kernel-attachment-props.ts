import { type Attachment, createAttachmentKey } from "svelte/attachments";

/**
 * Props that carry `attachments`, each under an attachment key made here, once. A wiring makes
 * them while it initialises and spreads them into the props it returns for an element, so one
 * spread of those props applies the attachments too. A key made on each read (inside a getter or a
 * derived) would be a new key every time, and Svelte would detach the attachment and attach it
 * again. Typed by the element they attach to, so they spread onto a plain element too.
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
