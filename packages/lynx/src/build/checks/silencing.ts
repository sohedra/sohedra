// The one comment that silences a diagnostic of the app's code on one line, in a script, in markup
// and in a style sheet alike:
//
//   // sohedra-ignore fill_not_imported
//   <!-- sohedra-ignore main_thread_handler_in_thread_branch -->
//   /* sohedra-ignore css_selector_unsupported */
//
// It names one code or more, apart by spaces or commas, and silences them on its own line and on
// the line after it. Svelte's own `svelte-ignore` is left to Svelte's warnings.

/** The comment's word. */
const IGNORE_COMMENT = "sohedra-ignore";

/** The comment, after a comment's opening, and the codes it names, to the comment's end. */
const IGNORE = new RegExp(
	`(?:\\/\\/|\\/\\*|<!--)\\s*${IGNORE_COMMENT}\\s+(.*?)(?:\\*\\/|-->|$)`,
	"g",
);

/** The codes the comments on a line silence. */
function codesOn(line: string | undefined): string[] {
	if (line === undefined || !line.includes(IGNORE_COMMENT)) return [];
	return [...line.matchAll(IGNORE)].flatMap((match) => match[1]!.split(/[\s,]+/).filter(Boolean));
}

/** A file's silencing comments: whether one silences `code` at an offset of `text`. */
export function silencer(text: string): (code: string, offset: number) => boolean {
	if (!text.includes(IGNORE_COMMENT)) return () => false;
	const lines = text.split("\n");
	const starts: number[] = [];
	let at = 0;
	for (const line of lines) {
		starts.push(at);
		at += line.length + 1;
	}
	return (code, offset) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (starts[middle]! <= offset) low = middle;
			else high = middle - 1;
		}
		return [lines[low], lines[low - 1]].some((line) => codesOn(line).includes(code));
	};
}
