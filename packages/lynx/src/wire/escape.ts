// Text that the build writes into generated code, and the first frame into its markup.

/**
 * JSON text as it goes into generated code or markup: `JSON.stringify` leaves `<`, `>` and the
 * line and paragraph separators as they are, so they are escaped (`\u003c`…). The text stays one
 * line for any engine, holds no markup, and reads back as the same JSON.
 */
export function escapeJsonText(json: string): string {
	return json.replace(
		/[<>\u2028\u2029]/g,
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
}
