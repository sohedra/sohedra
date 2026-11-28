// Splits a source file into its code and its comments, line for line, so a check reads only code
// and still reports the right line. Svelte files are read as markup, with their `<script>` blocks
// as code: a `//` in markup text is not a comment.

/** One comment: its kind, its first and last line (1-based) and its text, delimiters included. */
export interface Comment {
	kind: "line" | "block" | "doc" | "html";
	start: number;
	end: number;
	text: string;
}

/** A file's code with comments blanked (and string contents too, with `strings`), and its comments. */
export interface CodeText {
	code: string;
	comments: Comment[];
}

const REGEX_BEFORE = new Set("(,=:[!&|?{};~+-*%<>^".split(""));
const REGEX_AFTER_WORD =
	/(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

/** The code and comments of `text`, a file named `file`. */
export function codeText(
	text: string,
	file: string,
	options: { strings?: boolean } = {},
): CodeText {
	const lineAt = lineFinder(text);
	if (!file.endsWith(".svelte")) {
		return scanScript(text, 0, text.length, options, lineAt);
	}
	const comments: Comment[] = [];
	let code = "";
	let at = 0;
	const block = /<(script|style)\b[^>]*>/g;
	for (;;) {
		block.lastIndex = at;
		const open = block.exec(text);
		const markupEnd = open === null ? text.length : open.index + open[0].length;
		const markup = scanMarkup(text, at, markupEnd, lineAt);
		code += markup.code;
		comments.push(...markup.comments);
		if (open === null) break;
		const close = text.indexOf(`</${open[1]}>`, markupEnd);
		const bodyEnd = close === -1 ? text.length : close;
		const body = scanScript(text, markupEnd, bodyEnd, options, lineAt);
		code += body.code;
		comments.push(...body.comments);
		at = bodyEnd;
	}
	return { code, comments };
}

/** A function from an index in `text` to its 1-based line. */
function lineFinder(text: string): (index: number) => number {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
	return (index) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (starts[middle]! <= index) low = middle;
			else high = middle - 1;
		}
		return low + 1;
	};
}

function blank(part: string): string {
	return part.replace(/[^\n]/g, " ");
}

function scanMarkup(
	text: string,
	from: number,
	to: number,
	lineAt: (index: number) => number,
): CodeText {
	const comments: Comment[] = [];
	let code = "";
	let at = from;
	while (at < to) {
		const open = text.indexOf("<!--", at);
		if (open === -1 || open >= to) break;
		const close = text.indexOf("-->", open + 4);
		const end = close === -1 || close + 3 > to ? to : close + 3;
		code += text.slice(at, open) + blank(text.slice(open, end));
		comments.push({
			kind: "html",
			start: lineAt(open),
			end: lineAt(end - 1),
			text: text.slice(open, end),
		});
		at = end;
	}
	return { code: code + text.slice(at, to), comments };
}

function scanScript(
	text: string,
	from: number,
	to: number,
	options: { strings?: boolean },
	lineAt: (index: number) => number,
): CodeText {
	const comments: Comment[] = [];
	let code = "";
	let last = "";
	// Each `${` inside a template literal waits for its `}` at this brace depth.
	const templates: number[] = [];
	let depth = 0;
	let i = from;
	const keep = (part: string, isString: boolean): void => {
		code += isString && options.strings ? blank(part) : part;
	};
	const readString = (quote: string, start: number): number => {
		let j = start;
		while (j < to && text[j] !== quote && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
		return Math.min(j + 1, to);
	};
	// Reads template text from `start` to the closing backtick or the next `${`, whichever is first.
	const readTemplate = (start: number): number => {
		let j = start;
		while (j < to && text[j] !== "`" && !(text[j] === "$" && text[j + 1] === "{")) {
			j += text[j] === "\\" ? 2 : 1;
		}
		return j;
	};
	while (i < to) {
		const char = text[i]!;
		const next = text[i + 1];
		if (char === "/" && next === "/") {
			const end = text.indexOf("\n", i) === -1 ? to : Math.min(text.indexOf("\n", i), to);
			comments.push({ kind: "line", start: lineAt(i), end: lineAt(i), text: text.slice(i, end) });
			code += blank(text.slice(i, end));
			i = end;
			continue;
		}
		if (char === "/" && next === "*") {
			const close = text.indexOf("*/", i + 2);
			const end = close === -1 || close + 2 > to ? to : close + 2;
			const isDoc = text[i + 2] === "*" && text[i + 3] !== "/";
			comments.push({
				kind: isDoc ? "doc" : "block",
				start: lineAt(i),
				end: lineAt(end - 1),
				text: text.slice(i, end),
			});
			code += blank(text.slice(i, end));
			i = end;
			continue;
		}
		if (char === "'" || char === '"') {
			const end = readString(char, i + 1);
			keep(char, false);
			keep(text.slice(i + 1, end - 1), true);
			keep(text.slice(end - 1, end), false);
			i = end;
			last = char;
			continue;
		}
		if (char === "`" || (char === "}" && templates.at(-1) === depth)) {
			if (char === "}") templates.pop();
			const end = readTemplate(i + 1);
			code += char;
			keep(text.slice(i + 1, end), true);
			if (text[end] === "$") {
				code += "${";
				templates.push(depth);
				i = end + 2;
				last = "{";
			} else {
				code += text.slice(end, end + 1);
				i = end + 1;
				last = "`";
			}
			continue;
		}
		if (
			char === "/" &&
			(last === "" || REGEX_BEFORE.has(last) || REGEX_AFTER_WORD.test(code.slice(-12)))
		) {
			let j = i + 1;
			let inClass = false;
			while (j < to && text[j] !== "\n" && (inClass || text[j] !== "/")) {
				if (text[j] === "\\") j++;
				else if (text[j] === "[") inClass = true;
				else if (text[j] === "]") inClass = false;
				j++;
			}
			code += text.slice(i, j + 1);
			i = j + 1;
			last = "/";
			continue;
		}
		if (char === "{") depth++;
		if (char === "}") depth--;
		code += char;
		if (!/\s/.test(char)) last = /[\w$]/.test(char) ? "a" : char;
		i++;
	}
	return { code, comments };
}
