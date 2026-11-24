// The first frame's parser: the page's markup from Svelte's server renderer, as a tree of drawn
// nodes. It reads what `src/svelte/runtime/server-internals.ts` writes: a string in double quotes,
// a typed value as JSON in single quotes, and a function as a bare name, an event when the name is
// one. The branches Svelte's block markers bound (`<!--[0-->`, `<!--[-1-->`, `<!--[!-->` to
// `<!--]-->`) are kept as blocks: where the first frame and the background may render differently.
// The cells of a list on the page keep their markup unparsed until Lynx asks for them. A
// `<list-item>`'s `defer` is read here, and never set: Lynx has no such attribute.
//
// Plain string search and sticky regexes: the main thread's engine runs loops in JavaScript far
// slower than its regex matcher.

import {
	ASYNC_LIST,
	DEFER,
	eventOf,
	LIST_ITEM_INFO,
	removedEventSpelling,
	TEXT_CONTAINERS,
} from "../../wire/index.ts";
import type { AttrValue, LynxListener } from "../../wire/index.ts";

/** Svelte's void elements, which its server writes with no closing tag. */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
	"area",
	"base",
	"br",
	"col",
	"command",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/** An element or a text the first frame drew, with the id it has there. */
export interface DrawnNode {
	id: number;
	/** The element's tag; `#text` for a text. */
	tag: string;
	attrs: Map<string, AttrValue>;
	/** The events the markup listens to. */
	events: readonly LynxListener[];
	/** A text's text. */
	text: string | null;
	children: DrawnChild[];
	/** The cells of a list on the page, in order. */
	cells: DrawnCell[] | null;
}

/** A Svelte block: its content may differ between the first frame and the background. */
interface DrawnBlock {
	block: true;
	children: DrawnChild[];
}

export type DrawnChild = DrawnNode | DrawnBlock;

/** A cell of a list on the page: its attributes now, what is in it once Lynx asks for it. */
export interface DrawnCell {
	id: number;
	attrs: Map<string, AttrValue>;
	html: string;
	/** The cell's node, once its markup is parsed. */
	node: DrawnNode | null;
	/**
	 * A deferred row of Lynx's async list: drawn with nothing in it, so the list waits for the
	 * background's row instead of showing it.
	 */
	deferred: boolean;
}

/** Whether a child is a block. */
export const isBlock = (child: DrawnChild): child is DrawnBlock => "block" in child;

/** Why the markup could not be read, and where. */
export class UnreadableMarkup extends Error {
	readonly at: number;

	constructor(reason: string, at: number) {
		super(reason);
		this.at = at;
	}
}

const TAG_NAME = /[A-Za-z][A-Za-z0-9-]*/y;
const NAME = /[^\s=/>"']+/y;
const SPACE = /\s*/y;
// Inside a list on the page only the cells' bounds, the list's end and comments matter: a comment is
// skipped whole, so that a tag in it is never read (an app may keep its comments). A tag's quoted
// values may hold `>`. The `<` before the alternatives lets Lynx's regex engine skip from one `<` to
// the next; with an alternation first, it tries the pattern at every character.
const CELL_BOUNDARY =
	/<(?:!--|list-item\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>|\/list-item>|\/list>)/g;
const CELL_START = "<list-item";
const CELL_END = "</list-item>";
const COMMENT_START = "<!--";
const COMMENT_END = "-->";

const ENTITY = /&(amp|lt|gt|quot|#39);/g;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

function decode(text: string): string {
	return text.indexOf("&") === -1
		? text
		: text.replace(ENTITY, (_, name: string) => ENTITIES[name]!);
}

/** A bare attribute: a function's name, which binds an event when the name is one. */
function eventOfBare(name: string): LynxListener | undefined {
	const event = eventOf(name) ?? eventOf(removedEventSpelling(name)?.replacement ?? "");
	// A main-thread function's events are bound by its runtime, not here.
	return event && !event.mainThread ? { type: event.type, name: event.name } : undefined;
}

/** Makes ids for what the parser draws. */
export type NextId = () => number;

interface Tag {
	name: string;
	attrs: Map<string, AttrValue>;
	events: readonly LynxListener[];
	selfClosing: boolean;
	end: number;
}

/** The events of a tag that listens to none: one array for all of them. */
const NO_EVENTS: readonly LynxListener[] = Object.freeze([]);

/**
 * An opening tag as Svelte's server writes it: its name, then each attribute after one space, its
 * value, if any, in double or single quotes.
 */
const WRITTEN_TAG = /<([A-Za-z][A-Za-z0-9-]*)((?: [^\s=/>"']+(?:="[^"]*"|='[^']*')?)*)(\/?)>/y;

/** Sets an attribute from its raw value: a single-quoted one is JSON. */
function setAttribute(
	attrs: Map<string, AttrValue>,
	key: string,
	raw: string,
	quote: number,
): void {
	const value = decode(raw);
	// Boundary: a single-quoted value is JSON that the server's `attr` wrote.
	attrs.set(key, quote === 34 /* " */ ? value : (JSON.parse(value) as AttrValue));
}

/**
 * Reads an opening tag from `start` (at its `<`). A tag as the server writes it takes one regex
 * match and string searches; any other is read a step at a time, which says where it went wrong.
 */
function readTag(html: string, start: number): Tag {
	WRITTEN_TAG.lastIndex = start;
	const match = WRITTEN_TAG.exec(html);
	if (!match) return readTagSteps(html, start);
	const name = match[1]!;
	const written = match[2]!;
	const attrs = new Map<string, AttrValue>();
	let events: LynxListener[] | undefined;
	// After each attribute's space: its name runs to `=` or the next space.
	let i = 1;
	while (i <= written.length) {
		const equals = written.indexOf("=", i);
		const space = written.indexOf(" ", i);
		if (equals === -1 || (space !== -1 && space < equals)) {
			const end = space === -1 ? written.length : space;
			const event = eventOfBare(written.slice(i, end));
			if (event) (events ??= []).push(event);
			i = end + 1;
			continue;
		}
		const quote = written.charCodeAt(equals + 1);
		const close = written.indexOf(written[equals + 1]!, equals + 2);
		setAttribute(attrs, written.slice(i, equals), written.slice(equals + 2, close), quote);
		i = close + 2;
	}
	const selfClosing = match[3] === "/" || VOID_ELEMENTS.has(name);
	return {
		name,
		attrs,
		events: events ?? NO_EVENTS,
		selfClosing,
		end: WRITTEN_TAG.lastIndex,
	};
}

/** Reads an opening tag a step at a time, and throws where it cannot be read. */
function readTagSteps(html: string, start: number): Tag {
	TAG_NAME.lastIndex = start + 1;
	const match = TAG_NAME.exec(html);
	if (!match) throw new UnreadableMarkup("a tag has no name", start);
	const name = match[0];
	const attrs = new Map<string, AttrValue>();
	const events: LynxListener[] = [];
	let i = TAG_NAME.lastIndex;
	for (;;) {
		SPACE.lastIndex = i;
		SPACE.exec(html);
		i = SPACE.lastIndex;
		if (i >= html.length) throw new UnreadableMarkup(`the tag <${name}> is not closed`, start);
		const char = html[i];
		if (char === ">" || (char === "/" && html[i + 1] === ">")) {
			const selfClosing = char === "/" || VOID_ELEMENTS.has(name);
			return { name, attrs, events, selfClosing, end: i + (char === "/" ? 2 : 1) };
		}
		NAME.lastIndex = i;
		const attribute = NAME.exec(html);
		if (!attribute) throw new UnreadableMarkup(`an attribute of <${name}> has no name`, i);
		const key = attribute[0];
		i = NAME.lastIndex;
		if (html[i] !== "=") {
			const event = eventOfBare(key);
			if (event) events.push(event);
			continue;
		}
		const quote = html[i + 1];
		if (quote !== '"' && quote !== "'")
			throw new UnreadableMarkup(`the value of ${key} on <${name}> is not quoted`, i);
		const close = html.indexOf(quote, i + 2);
		if (close === -1)
			throw new UnreadableMarkup(`the value of ${key} on <${name}> is not closed`, i);
		setAttribute(attrs, key, html.slice(i + 2, close), html.charCodeAt(i + 1));
		i = close + 1;
	}
}

/** Takes a `<list-item>`'s `defer` out of its attributes, and returns its value. */
function takeDefer(attrs: Map<string, AttrValue>): AttrValue | undefined {
	const value = attrs.get(DEFER);
	attrs.delete(DEFER);
	return value;
}

/** A new drawn node. */
function node(id: number, tag: string): DrawnNode {
	return { id, tag, attrs: new Map(), events: [], text: null, children: [], cells: null };
}

/** A new drawn text. */
function textNode(id: number, text: string): DrawnNode {
	return { id, tag: "#text", attrs: new Map(), events: [], text, children: [], cells: null };
}

/** Whether a `<list-item>` tag starts at `at`. */
function cellStartsAt(html: string, at: number): boolean {
	if (!html.startsWith(CELL_START, at)) return false;
	const next = html.charCodeAt(at + CELL_START.length);
	return next === 32 /* space */ || next === 62 /* > */ || next === 47; /* / */
}

/** The index after the comment that starts at `at`. */
function afterComment(html: string, at: number): number {
	const close = html.indexOf(COMMENT_END, at + COMMENT_START.length);
	if (close === -1) throw new UnreadableMarkup("a comment is not closed", at);
	return close + COMMENT_END.length;
}

/** Whether `text` has a comment that may hide a tag: one with a `<` in it, or not closed. */
function hidesTag(text: string): boolean {
	let at = text.indexOf(COMMENT_START);
	while (at !== -1) {
		const close = text.indexOf(COMMENT_END, at + COMMENT_START.length);
		if (close === -1) return true;
		const lt = text.indexOf("<", at + COMMENT_START.length);
		if (lt !== -1 && lt < close) return true;
		at = text.indexOf(COMMENT_START, close + COMMENT_END.length);
	}
	return false;
}

/**
 * Reads the markup of `cell`, from `from` to its `</list-item>`, past those of the list items
 * inside it and any in a comment, and returns the index after it. `start` is where the list's
 * cells start, for the error.
 */
function readCell(html: string, from: number, start: number, cell: DrawnCell): number {
	// A cell with no list inside ends at the first `</list-item>` that no comment hides: text
	// searches, which cost far less than matching the regex at every tag in the cell.
	const end = html.indexOf(CELL_END, from);
	const inner = html.indexOf("<list", from);
	if (end !== -1 && (inner === -1 || inner > end)) {
		const text = html.slice(from, end);
		if (!hidesTag(text)) {
			cell.html = text;
			return end + CELL_END.length;
		}
	}
	CELL_BOUNDARY.lastIndex = from;
	let depth = 1;
	for (;;) {
		const match = CELL_BOUNDARY.exec(html);
		if (!match) throw new UnreadableMarkup("a <list> is not closed", start);
		const token = match[0];
		if (token === COMMENT_START) {
			CELL_BOUNDARY.lastIndex = afterComment(html, match.index);
		} else if (token === CELL_END) {
			if (--depth > 0) continue;
			cell.html = html.slice(from, match.index);
			return CELL_BOUNDARY.lastIndex;
		} else if (token !== "</list>" && match[1] !== "/") {
			depth++;
		}
	}
}

/**
 * The cells of a list on the page, from `start` (just after `<list …>`), each one's markup kept as
 * it is. Returns the index after `</list>`.
 */
function scanCells(html: string, start: number, list: DrawnNode, nextId: NextId): number {
	const cells: DrawnCell[] = [];
	list.cells = cells;
	const async = list.attrs.get("custom-list-name") === ASYNC_LIST;
	let at = start;
	for (;;) {
		// The cells of an `{#each}` follow one another, with Svelte's block markers around them.
		if (!cellStartsAt(html, at)) {
			if (html.startsWith(COMMENT_START, at)) {
				at = afterComment(html, at);
				continue;
			}
			CELL_BOUNDARY.lastIndex = at;
			const match = CELL_BOUNDARY.exec(html);
			if (!match) throw new UnreadableMarkup("a <list> is not closed", start);
			const token = match[0];
			if (token === COMMENT_START) {
				at = afterComment(html, match.index);
				continue;
			}
			if (token === "</list>") return CELL_BOUNDARY.lastIndex;
			// The server never writes one: a cell before it ended in the wrong place.
			if (token === CELL_END)
				throw new UnreadableMarkup("a </list-item> closes no <list-item>", match.index);
			at = match.index;
		}
		const tag = readTag(html, at);
		const deferred = Boolean(takeDefer(tag.attrs)) && async;
		const cell: DrawnCell = { id: nextId(), attrs: tag.attrs, html: "", node: null, deferred };
		cells.push(cell);
		at = tag.end;
		if (tag.selfClosing) continue;
		at = readCell(html, at, start, cell);
	}
}

/**
 * Parses `html` into `parent`'s children. A list's cells are scanned, not parsed, unless `inCell`:
 * a list inside a cell gets its items as children, as the background sends them.
 */
function parseInto(
	html: string,
	parent: DrawnNode,
	options: { nextId: NextId; inCell: boolean },
): void {
	const { nextId, inCell } = options;
	// The open element, where its next child goes (an open block's children, or its own), and how
	// many blocks are open in it. The elements open around it wait in `outer`, each with where its
	// own children went and its blocks' count; the children arrays the blocks were opened in wait
	// in `blocks`. Arrays and locals: an object or a closure call per element costs the main
	// thread's engine more than reading the markup does.
	let node = parent;
	let into = parent.children;
	let depth = 0;
	const outer: DrawnNode[] = [];
	const outerInto: DrawnChild[][] = [];
	const outerDepth: number[] = [];
	const blocks: DrawnChild[][] = [];
	const length = html.length;
	let i = 0;
	while (i < length) {
		const lt = html.indexOf("<", i);
		const end = lt === -1 ? length : lt;
		if (end > i) {
			if (TEXT_CONTAINERS.has(node.tag)) {
				const drawn = textNode(nextId(), decode(html.slice(i, end)));
				into.push(drawn);
			} else if (node.tag === "textarea") {
				// Svelte's server writes a textarea's value as its content.
				node.attrs.set("default-value", decode(html.slice(i, end)));
			}
		}
		if (lt === -1) break;
		const next = html.charCodeAt(lt + 1);
		if (next === 33 /* ! */ && html.startsWith(COMMENT_START, lt)) {
			const close = html.indexOf(COMMENT_END, lt + 4);
			if (close === -1) throw new UnreadableMarkup("a comment is not closed", lt);
			// Svelte's block markers: `[` and `]` alone, or `[` and a branch's mark.
			if (html.charCodeAt(lt + 4) === 91 /* [ */) {
				blocks.push(into);
				depth++;
				if (close > lt + 5) {
					// An `{#if}`'s branch (`[0`, `[-1`), an else (`[!`) or a failed boundary (`[?`).
					const block: DrawnBlock = { block: true, children: [] };
					into.push(block);
					into = block.children;
				}
				// Alone, a component's fragment, an `{#each}` or a `{#key}`: its content is the same on
				// both threads for the same data, so it is read as if it were not there.
			} else if (close === lt + 5 && html.charCodeAt(lt + 4) === 93 /* ] */ && depth > 0) {
				into = blocks.pop()!;
				depth--;
			}
			i = close + 3;
			continue;
		}
		if (next === 47 /* / */) {
			const close = html.indexOf(">", lt);
			if (close === -1) throw new UnreadableMarkup("a closing tag is not closed", lt);
			if (outer.length === 0) throw new UnreadableMarkup("a closing tag has no element", lt);
			// The element's blocks end with it.
			blocks.length -= depth;
			node = outer.pop()!;
			into = outerInto.pop()!;
			depth = outerDepth.pop()!;
			i = close + 1;
			continue;
		}
		const tag = readTag(html, lt);
		const name = tag.name;
		const attrs = tag.attrs;
		// A row of a list inside a cell renders at once.
		if (name === "list-item") takeDefer(attrs);
		// A Lynx input has no `value`: its first value is `default-value`, as the background sets it.
		if (name === "input" || name === "textarea") {
			const value = attrs.get("value");
			if (value !== undefined) {
				attrs.delete("value");
				attrs.set("default-value", value);
			}
		}
		const drawn: DrawnNode = {
			id: nextId(),
			tag: name,
			attrs,
			events: tag.events,
			text: null,
			children: [],
			cells: null,
		};
		into.push(drawn);
		i = tag.end;
		if (tag.selfClosing) continue;
		if (name === "list" && !inCell) {
			i = scanCells(html, i, drawn, nextId);
			continue;
		}
		outer.push(node);
		outerInto.push(into);
		outerDepth.push(depth);
		node = drawn;
		into = drawn.children;
		depth = 0;
	}
	if (outer.length > 0)
		throw new UnreadableMarkup(`the element <${node.tag}> is not closed`, html.length);
}

/** The page's drawn tree from its markup; the page is `rootId`. */
export function parsePage(html: string, rootId: number, nextId: NextId): DrawnNode {
	const page = node(rootId, "page");
	parseInto(html, page, { nextId, inCell: false });
	return page;
}

/** A cell's node, with its markup parsed (a list inside it gets its items as children). */
export function parseCell(cell: DrawnCell, nextId: NextId): DrawnNode {
	const drawn = node(cell.id, "list-item");
	drawn.attrs = cell.attrs;
	parseInto(cell.html, drawn, { nextId, inCell: true });
	cell.node = drawn;
	return drawn;
}

/** The elements of `children`, blocks opened, in order. */
export function elementsOf(children: DrawnChild[], out: DrawnNode[] = []): DrawnNode[] {
	for (const child of children) {
		if (isBlock(child)) elementsOf(child.children, out);
		else out.push(child);
	}
	return out;
}

/** The info a cell gives its list (`item-key` and the rest). */
export function cellInfo(cell: DrawnCell): Record<string, unknown> {
	const info: Record<string, unknown> = {};
	// `forEach`: a `for…of` over a map's entries makes an array of each, which the main thread's
	// engine pays for in every cell of the list.
	cell.attrs.forEach((value, key) => {
		if (LIST_ITEM_INFO.has(key)) info[key] = value;
	});
	return info;
}
