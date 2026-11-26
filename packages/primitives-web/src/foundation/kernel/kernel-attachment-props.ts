import { type Attachment, createAttachmentKey } from "svelte/attachments";

import type { Props } from "./kernel-merged-props.js";

/**
 * Props that carry `attachments`, each under an attachment key made here, once. A wiring makes
 * them while it initialises and spreads them into the props it returns for an element, so one
 * spread of those props applies the attachments too. A key made on each read (inside a getter or a
 * derived) would be a new key every time, and Svelte would detach the attachment and attach it
 * again.
 */
export function attachmentProps(...attachments: readonly Attachment<never>[]): Props {
	const props: Props = {};
	for (const attachment of attachments) {
		props[createAttachmentKey()] = attachment;
	}
	return props;
}
