import type { ClaimedValue } from "@sohedra/primitives-core/foundation/kernel";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import { attachmentProps } from "./kernel-attachment-props.js";
import { ownerDocument } from "./kernel-dom.js";
import type { Props } from "./kernel-merged-props.js";

/**
 * Runs `connect` once `element` is in a document, now or when it's moved there, and its cleanup
 * on teardown. Content inside a `<svelte:boundary>` that shows its `pending` snippet is attached in
 * a detached fragment, and moved into the document when it resolves.
 */
function whenConnected(element: Element, connect: () => () => void): () => void {
	if (element.isConnected) {
		return connect();
	}
	let release: (() => void) | undefined;
	const observer = new MutationObserver(() => {
		if (element.isConnected) {
			observer.disconnect();
			release = connect();
		}
	});
	// Moving the element out of its detached root (a fragment) changes that root; inserting a
	// detached root changes the document.
	const options = { childList: true, subtree: true };
	observer.observe(element.getRootNode(), options);
	observer.observe(ownerDocument(element), options);
	return () => {
		observer.disconnect();
		release?.();
	};
}

/**
 * An attachment that holds `claim(token, value)` while its element is in the document, so an
 * `aria-*` attribute never names a missing element; a new `get` value claims again. Each has its
 * own token, so an element replacing another (a `render` swap) keeps its claim.
 */
export function attachClaim<T>(
	claim: (token: object, value: T) => () => void,
	get: () => T | undefined,
): Attachment {
	return (element) => {
		const value = get();
		if (value === undefined) {
			return;
		}
		const token = {};
		return untrack(() => whenConnected(element, () => claim(token, value)));
	};
}

/** What `useClaimedId` reads, from the part's options function. */
export interface ClaimedIdOptions {
	/** The `id` prop. */
	readonly id: string | null | undefined;
}

/**
 * A part whose id another element names (a Title, a Description, a Label): `props` hold its `id`
 * (the prop, else `fixed.defaultId`) with its claim on `slot` as an attachment, so the store names
 * it only while it is in the document. Spread `props` once on the part's element.
 */
export function useClaimedId(
	slot: ClaimedValue<string>,
	options: () => ClaimedIdOptions,
	fixed: { readonly defaultId: string },
): { readonly props: Props } {
	const id = $derived(options().id ?? fixed.defaultId);
	return {
		props: {
			get id() {
				return id;
			},
			...attachmentProps(
				attachClaim(
					(token, value: string) => slot.claim(token, value),
					() => id,
				),
			),
		},
	};
}
