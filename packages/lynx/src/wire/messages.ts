// The shape of the binding's messages, shared by every program's catalogue: a plain sentence in
// the developer's own names, then where, then one concrete fix, then the docs page that carries
// the message's stable code.

/** Where the docs pages of messages live; a message's page is its code under `/e/`. */
export const DOCS_BASE = "https://sohedra.com/e/";

/** One message of a catalogue, for the details it needs. */
export interface Entry<Details> {
	/** The plain sentence that says what went wrong, in the developer's own names. */
	message: (details: Details) => string;
	/** The one concrete next step. */
	fix: (details: Details) => string;
	/** The docs page's name, in snake_case: the stable code of the message. */
	docs: string;
}

/** A program's messages: one entry for each code of `Details`, the details that code needs. */
export type Catalogue<Details> = { readonly [Code in keyof Details]: Entry<Details[Code]> };

/** The link of the docs page named `docs`. */
export function docsLink(docs: string): string {
	return `${DOCS_BASE}${docs}`;
}

/** The parts of one message. */
interface MessageParts {
	/** The plain sentence. */
	sentence: string;
	/** `file:line:col`, or the component, when known. */
	where?: string | undefined;
	/** A few lines of the source around the place, with a caret under it. */
	frame?: string | undefined;
	/** The next step. */
	fix?: string | undefined;
	/** The docs link. */
	link?: string | undefined;
}

/**
 * The text of a message: the sentence first, since a collapsed console shows only the first line,
 * then where, the code frame, the fix and the link.
 */
export function formatMessage({ sentence, where, frame, fix, link }: MessageParts): string {
	const head = where === undefined ? [sentence] : [sentence, where];
	const tail = [fix, link].filter((line) => line !== undefined);
	const blocks = [head.join("\n"), frame, tail.join("\n")].filter(
		(block) => block !== undefined && block !== "",
	);
	return blocks.join("\n\n");
}

/** One message of a catalogue: its code and the details it is written from. */
export interface CatalogueReport<Details, Code extends keyof Details> {
	code: Code;
	details: Details[Code];
}

/** The text of one message of `catalogue`; a `where` in its details goes under the sentence. */
export function catalogueMessage<Details, Code extends keyof Details>(
	catalogue: Catalogue<Details>,
	{ code, details }: CatalogueReport<Details, Code>,
): string {
	const entry = catalogue[code];
	// Boundary: `where` is optional in the details of the codes that have it.
	const where = (details as { where?: string | undefined }).where;
	return formatMessage({
		sentence: entry.message(details),
		where,
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** The error for one message of `catalogue`: its text is the message, and `code` its stable code. */
export function catalogueError<Details, Code extends keyof Details>(
	catalogue: Catalogue<Details>,
	report: CatalogueReport<Details, Code>,
): Error & { code: Code } {
	return Object.assign(new Error(catalogueMessage(catalogue, report)), { code: report.code });
}
