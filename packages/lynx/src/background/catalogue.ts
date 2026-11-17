// The background's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/background/catalogue.test.ts` fails for an entry without a fix or a page, and
// snapshots every message.

import { docsLink, formatMessage } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the background's messages is written from. */
export interface BackgroundDetails {
	/** `call` names what was asked of the main thread. */
	page_is_gone: { call: string };
	/** `where` is the component's `file:line:col`, when Svelte's development build gives it. */
	text_outside_text: { text: string; parent: string; where?: string | undefined };
	list_item_key_object: { where?: string | undefined };
	input_value_not_written: { tag: string; reason: string };
	/** `name` is the attribute's. */
	attribute_not_copyable: { name: string; tag: string; reason: string };
	/** `method` is the element method the developer called. */
	element_not_on_page: { method: string; tag: string };
	element_not_shown: { method: string; tag: string };
	animation_canceled: { name: string };
}

/** What a code of the background names. */
export type BackgroundCode = keyof BackgroundDetails;

/** Every message of the background. */
export const BACKGROUND_CATALOGUE: Catalogue<BackgroundDetails> = {
	page_is_gone: {
		message: ({ call }) =>
			`A call of ${call} has no answer: the page it was made on has been closed or reloaded.`,
		fix: () =>
			"Nothing to fix when the page closed on purpose. Otherwise, make the call again on the page that is open now.",
		docs: "page_is_gone",
	},
	text_outside_text: {
		message: ({ text, parent }) =>
			`The text "${text}" is inside <${parent}>, and Lynx shows text only inside <text>.`,
		fix: ({ text }) => `Wrap it in <text>: <text>${text}</text>.`,
		docs: "text_outside_text",
	},
	list_item_key_object: {
		message: () =>
			"A <list-item> has an object as its item-key, and Lynx reads an item-key as text.",
		fix: () =>
			"Key the item with a string or a number that names it, such as its id: {#each items as item (item.id)}, or item-key={item.id}.",
		docs: "list_item_key_object",
	},
	input_value_not_written: {
		message: ({ tag, reason }) =>
			`The value of the <${tag}> element could not be written: ${reason.split("\n")[0]!.trim()}`,
		fix: () =>
			"Check that the element is still on the page when its value changes, and that it is an <input> or a <textarea>.",
		docs: "input_value_not_written",
	},
	attribute_not_copyable: {
		message: ({ name, tag, reason }) =>
			`The value of ${name} on <${tag}> cannot be sent to the main thread (${reason.split("\n")[0]!.trim()}), so the element does not get it.`,
		fix: () =>
			"Give the attribute plain data: strings, numbers, booleans, null, arrays and plain objects, without cycles or BigInt values.",
		docs: "attribute_not_copyable",
	},
	element_not_on_page: {
		message: ({ method, tag }) =>
			`The <${tag}> is not on the page, so its ${method} cannot run: Lynx has no element for it.`,
		fix: ({ method }) =>
			`Call ${method} once the element is on the page: in an attachment, an effect or an event handler, not while the component is being built or after the element was removed.`,
		docs: "element_not_on_page",
	},
	element_not_shown: {
		message: ({ method, tag }) =>
			`The <${tag}> is in a list row Lynx has not shown yet, so its ${method} cannot run: Lynx makes a row's elements only when it shows the row.`,
		fix: ({ method }) =>
			`Call ${method} once Lynx shows the row, for example from the row's layoutchange event.`,
		docs: "element_not_shown",
	},
	animation_canceled: {
		message: ({ name }) => `The animation ${name} was canceled before it finished.`,
		fix: () =>
			"Nothing to fix when the animation was canceled on purpose. Catch the rejection of finished where a canceled animation matters.",
		docs: "animation_canceled",
	},
};

/** One message of the background: its code and the details it is written from. */
export interface BackgroundReport<Code extends BackgroundCode> {
	code: Code;
	details: BackgroundDetails[Code];
}

/** The text of a message of the background. */
export function backgroundMessage<Code extends BackgroundCode>({
	code,
	details,
}: BackgroundReport<Code>): string {
	const entry = BACKGROUND_CATALOGUE[code];
	// Boundary: `where` is optional in the details of the codes that have it.
	const where = (details as { where?: string | undefined }).where;
	return formatMessage({
		sentence: entry.message(details),
		where,
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** An error of the background: its text is the message, and `code` the message's stable code. */
export type BackgroundError = Error & { code: BackgroundCode };

/** The error for a message of the background. */
export function backgroundError<Code extends BackgroundCode>(
	report: BackgroundReport<Code>,
): BackgroundError {
	return Object.assign(new Error(backgroundMessage(report)), { code: report.code });
}
