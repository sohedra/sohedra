import type { OwnedValue } from "@sohedra/primitives-core/foundation/kernel/index.js";
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
 * An attachment that holds `claim(token, value)` while its element is in the document, releasing
 * and claiming again when `get` returns a new value (`undefined` claims nothing). A part whose id
 * another element names in an `aria-*` attribute claims it this way, so the attribute never names
 * an element that isn't in the document, as when the part is still loading inside a boundary.
 * Each attachment claims with its own token, so an element replacing another (a `render` swap)
 * keeps its claim when the old one detaches after it.
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
	/** The generated id, used when the prop gives none. */
	readonly defaultId: string;
}

/**
 * The props of a part whose id another element names (a Title, a Description, a Label): its `id`,
 * with the claim of that id by `owner` riding inside as an attachment, so the owner names it only
 * while the element is in the document. Spread once on the part's element. Call once while the
 * part initialises.
 */
export function useClaimedId(owner: OwnedValue<string>, options: () => ClaimedIdOptions): Props {
	const id = $derived(options().id ?? options().defaultId);
	return {
		get id() {
			return id;
		},
		...attachmentProps(
			attachClaim(
				(token, value: string) => owner.claim(token, value),
				() => id,
			),
		),
	};
}
