// What the compiler throws and warns, read by its codes and text.

/** An error or a warning of Svelte's compiler. */
export interface Diagnostic {
	code: string;
	message: string;
	filename?: string | null | undefined;
	/** Line is 1-based, column 0-based, and `character` an index into the compiled text. */
	start?: { line: number; column: number; character?: number } | undefined;
	frame?: string | null | undefined;
}

/** Whether `value` is an error or a warning of Svelte's compiler. */
export function isDiagnostic(value: unknown): value is Diagnostic {
	if (value === null || typeof value !== "object") return false;
	// Boundary: a thrown value is unknown; its two fields are checked before it is used.
	const { code, message } = value as { code?: unknown; message?: unknown };
	return typeof code === "string" && typeof message === "string";
}

/** Svelte appends the link of its docs page, on a line of its own, to the message. */
const LINK = /\n(https:\/\/svelte\.dev\/e\/\S+)$/;

/** A diagnostic's message without its docs link, and the link. */
export function splitLink(message: string): { sentence: string; link: string | undefined } {
	const match = LINK.exec(message);
	if (match === null) return { sentence: message, link: undefined };
	return { sentence: message.slice(0, match.index), link: match[1] };
}

const BANNED_CODE = "incompatible_with_custom_renderer";
// Svelte's message: "%message% is not compatible with `customRenderer`", then its link line.
const BANNED_MESSAGE = /^(.+) is not compatible with `customRenderer`(\n.*)?$/s;

/**
 * The feature a custom renderer refuses, as Svelte names it ("`bind:`", "`<svelte:window>`"),
 * when `error` is that error; otherwise `undefined`.
 */
export function bannedFeature(error: unknown): string | undefined {
	if (!isDiagnostic(error) || error.code !== BANNED_CODE) return undefined;
	return BANNED_MESSAGE.exec(error.message)?.[1];
}
