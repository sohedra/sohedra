// `__QuerySelector` and `__QuerySelectorAll` as Lynx selects: a small grammar of its own, matched
// from the element it starts at, that element included (core/renderer/css/select_element_token.cc,
// ParseCssSelector; core/renderer/dom/selector/fiber_element_selector.cc, SelectImplRecursive;
// core/renderer/dom/attribute_holder.cc, ContainsSelector). Lynx finds nothing for a selector its
// grammar does not take; the engine fake throws, as that is a mistake in the page.

import type { ElementState } from "./state.ts";

/** One part of a compound selector: a tag, `#id`, `.class` or an attribute test. */
type Part =
	| { kind: "tag"; name: string }
	| { kind: "id"; name: string }
	| { kind: "class"; name: string }
	| { kind: "attribute"; name: string; test: (value: string) => boolean };

/** A compound selector, and how the next one relates to it: a descendant or a child. */
interface Token {
	parts: Part[];
	/** How the next token's elements relate to this one's; none for the last. */
	next: "descendant" | "child" | undefined;
}

/** A name in Lynx's selectors: what the fake takes as a tag, an id, a class or an attribute. */
const NAME = /^[A-Za-z_][\w-]*$/;
const ATTRIBUTE = /^\[([\w-]+)(?:([*^$]?)=([^\]]*))?\]$/;

/** The error for a selector the fake does not take, saying what Lynx does with it. */
function refused(selector: string, why: string): Error {
	return new Error(
		`Lynx's selectors do not take ${JSON.stringify(selector)}: ${why}. Lynx finds nothing for it. ` +
			"Use a tag, #id, .class or [attribute=value], joined by a space or >.",
	);
}

/** The parts of a compound selector such as `view.row#a[data-x=1]`. */
function partsOf(compound: string, selector: string): Part[] {
	const parts: Part[] = [];
	const pieces = compound.match(/\[[^\]]*\]|[#.]?[^#.[]+|[#.[]/g) ?? [];
	if (pieces.join("") !== compound) throw refused(selector, `it cannot read ${compound}`);
	for (const [index, piece] of pieces.entries()) {
		if (piece.startsWith("[")) {
			const match = ATTRIBUTE.exec(piece);
			if (!match) throw refused(selector, `${piece} is not an attribute test it knows`);
			const [, name, op, expected] = match as unknown as [string, string, string, string?];
			if (expected !== undefined && /^["']/.test(expected)) {
				throw new Error(
					`Lynx compares the quotes as part of the value in ${piece}, so it matches nothing. ` +
						`Write ${piece.replace(/["']/g, "")}.`,
				);
			}
			const test =
				expected === undefined
					? () => true
					: op === "*"
						? (value: string) => value.includes(expected)
						: op === "^"
							? (value: string) => value.startsWith(expected)
							: op === "$"
								? (value: string) => value.endsWith(expected)
								: (value: string) => value === expected;
			parts.push({ kind: "attribute", name, test });
			continue;
		}
		const kind = piece.startsWith("#") ? "id" : piece.startsWith(".") ? "class" : "tag";
		const name = kind === "tag" ? piece : piece.slice(1);
		if (kind === "tag" && index > 0) throw refused(selector, `${piece} is not where a tag goes`);
		if (!NAME.test(name)) throw refused(selector, `${piece} is not a name it knows`);
		parts.push({ kind, name });
	}
	return parts;
}

/** The tokens of one selector of a list: compounds joined by a space, `>` or `>>>`. */
function tokensOf(selector: string, whole: string): Token[] {
	const tokens: Token[] = [];
	const words = selector
		.trim()
		.replace(/\s*(>>>|>)\s*/g, " $1 ")
		.split(/\s+/)
		.filter((word) => word !== "");
	if (words.length === 0) throw refused(whole, "one of its selectors is empty");
	for (let index = 0; index < words.length; index++) {
		const word = words[index]!;
		if (word === ">" || word === ">>>") throw refused(whole, `${word} has nothing before it`);
		const after = words[index + 1];
		const combinator = after === ">" ? "child" : "descendant";
		if (after === ">" || after === ">>>") {
			index++;
			if (index === words.length - 1) throw refused(whole, `${after} has nothing after it`);
		}
		tokens.push({
			parts: partsOf(word, whole),
			next: index === words.length - 1 ? undefined : combinator,
		});
	}
	return tokens;
}

/** Whether an element matches every part of a compound selector. */
function matches(state: ElementState, parts: Part[]): boolean {
	return parts.every((part) => {
		if (part.kind === "tag") return state.tag === part.name;
		if (part.kind === "id") return state.id === part.name;
		if (part.kind === "class") return state.classes.split(/\s+/).includes(part.name);
		// `data-` reads the dataset, by the key as it was given; any other name the attributes.
		const source = part.name.startsWith("data-") ? state.dataset : state.attrs;
		const key = part.name.startsWith("data-") ? part.name.slice(5) : part.name;
		if (!Object.hasOwn(source, key)) return false;
		const value = source[key];
		return part.test(typeof value === "string" ? value : JSON.stringify(value));
	});
}

/**
 * The elements under `root`, `root` included, that `selector` matches, in the tree's order. With
 * `first`, Lynx stops at the first selector of a list that finds one.
 */
export function select(options: {
	root: ElementState;
	selector: string;
	first: boolean;
	children: (state: ElementState) => ElementState[];
	order: (state: ElementState) => number;
}): ElementState[] {
	const { root, selector, first, children, order } = options;
	// An empty selector is the element itself, "for compatibility" (element_selector.cc).
	if (selector === "") return [root];
	const lists = selector.split(",").map((part) => tokensOf(part, selector));
	const found = new Set<ElementState>();

	function visit(state: ElementState, tokens: Token[], at: number, descend: boolean): void {
		const token = tokens[at]!;
		const satisfied = matches(state, token.parts);
		if (satisfied && token.next === undefined) found.add(state);
		const next = children(state);
		if (satisfied && token.next !== undefined) {
			for (const child of next) visit(child, tokens, at + 1, token.next === "descendant");
		}
		if (descend) for (const child of next) visit(child, tokens, at, true);
	}

	for (const tokens of lists) {
		visit(root, tokens, 0, true);
		if (first && found.size > 0) break;
	}
	return [...found].toSorted((a, b) => order(a) - order(b));
}
