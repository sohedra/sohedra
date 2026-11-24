// The selectors Lynx supports, as its reference lists them (lynxjs.org/api/css/selectors): type
// selectors (`page` for the root), classes, ids, the universal selector, the descendant, child,
// next-sibling and subsequent-sibling combinators, selector lists, and the pseudo-classes
// `:active`, `:hover`, `:not()` and `:root`. It lists no attribute selector, no other pseudo-class
// and no pseudo-element. Anything outside that list is found, so the check needs no list of what
// fails: the list of what works is Lynx's own. Svelte's `:global(…)` is read through.

import type { AnyNode } from "../../svelte/build/index.ts";

/** The pseudo-classes Lynx lists, and Svelte's `:global`, which leaves the compiled CSS. */
const PSEUDO_CLASSES = new Set(["active", "hover", "not", "root", "global"]);

/** The combinators Lynx lists. */
const COMBINATORS = new Set([" ", ">", "+", "~"]);

/** The rules inside these at-rules hold no selectors. */
const NO_SELECTORS = new Set(["keyframes", "-webkit-keyframes", "font-face", "page"]);

/** The selector types Lynx lists. */
const SIMPLE = new Set(["TypeSelector", "ClassSelector", "IdSelector", "NestingSelector"]);

/** A selector Lynx doesn't support: the selector, the part of it, and where the selector starts. */
interface UnsupportedSelector {
	/** The complex selector, as written. */
	selector: string;
	/** The part outside Lynx's list, as a phrase with its text in backticks. */
	part: string;
	start: number;
}

/** The node's list of child nodes under `key`. */
const childrenOf = (node: AnyNode | undefined, key: string): AnyNode[] =>
	// Boundary: Svelte's CSS nodes are read by shape.
	(node?.[key] ?? []) as AnyNode[];

/** The first part of a complex selector outside Lynx's list, as a phrase; nothing when all is in it. */
function unsupportedPart(complex: AnyNode, source: string): string | undefined {
	for (const relative of childrenOf(complex, "children")) {
		const combinator = relative.combinator as AnyNode | null;
		if (combinator && !COMBINATORS.has(String(combinator.name)))
			return `the \`${String(combinator.name)}\` combinator`;
		for (const selector of childrenOf(relative, "selectors")) {
			const type = String(selector.type);
			if (SIMPLE.has(type)) continue;
			const text = source.slice(selector.start, selector.end);
			if (type === "PseudoClassSelector" && PSEUDO_CLASSES.has(String(selector.name))) {
				for (const inner of childrenOf(selector.args as AnyNode | undefined, "children")) {
					const part = unsupportedPart(inner, source);
					if (part !== undefined) return part;
				}
				continue;
			}
			if (type === "AttributeSelector") return `the attribute selector \`${text}\``;
			if (type === "PseudoElementSelector") return `the pseudo-element \`${text}\``;
			// The selectors left are pseudo-classes: a `:nth-child()`'s or a keyframe's parts sit
			// inside a pseudo-class's arguments or a `@keyframes`, neither of which is read here.
			return `the pseudo-class \`${text}\``;
		}
	}
	return undefined;
}

/**
 * The selectors outside Lynx's list in a style sheet (Svelte's syntax tree of a `<style>`), one for
 * each complex selector, in order. `source` is the text the tree's positions point into.
 */
export function unsupportedSelectors(sheet: AnyNode, source: string): UnsupportedSelector[] {
	const found: UnsupportedSelector[] = [];
	const visit = (rules: AnyNode[]): void => {
		for (const rule of rules) {
			if (rule.type === "Atrule") {
				if (!NO_SELECTORS.has(String(rule.name)))
					visit(childrenOf(rule.block as AnyNode, "children"));
				continue;
			}
			if (rule.type !== "Rule") continue;
			for (const complex of childrenOf(rule.prelude as AnyNode, "children")) {
				const part = unsupportedPart(complex, source);
				if (part !== undefined)
					found.push({
						selector: source.slice(complex.start, complex.end),
						part,
						start: complex.start!,
					});
			}
			visit(childrenOf(rule.block as AnyNode, "children"));
		}
	};
	visit(childrenOf(sheet, "children"));
	return found;
}
