import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

interface Declaration {
	readonly value: string;
	readonly priority: "" | "important";
}

/**
 * The declarations of a `style` attribute value, by property: the last declaration of a property
 * wins, as in the attribute, and a `;` inside parentheses or quotes (a data URL) doesn't split.
 */
function parseStyle(text: string | null | undefined): Map<string, Declaration> {
	const declarations = new Map<string, Declaration>();
	if (!text) {
		return declarations;
	}
	let start = 0;
	let depth = 0;
	let quote: string | null = null;
	const take = (end: number) => {
		const part = text.slice(start, end);
		start = end + 1;
		const colon = part.indexOf(":");
		if (colon < 0) {
			return;
		}
		const name = part.slice(0, colon).trim();
		let value = part.slice(colon + 1).trim();
		if (!name || !value) {
			return;
		}
		let priority: Declaration["priority"] = "";
		const important = /!\s*important\s*$/i.exec(value);
		if (important) {
			priority = "important";
			value = value.slice(0, important.index).trim();
		}
		const property = name.startsWith("--") ? name : name.toLowerCase();
		declarations.delete(property);
		declarations.set(property, { value, priority });
	};
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		if (quote) {
			if (char === "\\") {
				index++;
			} else if (char === quote) {
				quote = null;
			}
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "(") {
			depth++;
		} else if (char === ")") {
			depth = Math.max(0, depth - 1);
		} else if (char === ";" && depth === 0) {
			take(index);
		}
	}
	take(text.length);
	return declarations;
}

/**
 * Applies a part's computed `style` to its element property by property, as React patches a
 * style object: a changed declaration is set, one this attachment set that is gone is removed,
 * and inline styles others set (an attachment, a measuring wiring) are left alone. A spread
 * `style` string would replace the whole attribute on every change. The attachment re-runs when
 * the style changes; put it before the element's other attachments, so they see it applied.
 */
export function attachStyle(get: () => string | null | undefined): Attachment<HTMLElement> {
	// What was applied to each element (a render swap attaches a new one).
	const appliedTo = new WeakMap<HTMLElement, Map<string, Declaration>>();
	return (element) => {
		const next = parseStyle(get());
		untrack(() => {
			const applied = appliedTo.get(element) ?? new Map<string, Declaration>();
			for (const property of applied.keys()) {
				if (!next.has(property)) {
					element.style.removeProperty(property);
				}
			}
			for (const [property, declaration] of next) {
				const previous = applied.get(property);
				if (previous?.value !== declaration.value || previous.priority !== declaration.priority) {
					element.style.setProperty(property, declaration.value, declaration.priority);
				}
			}
			appliedTo.set(element, next);
		});
	};
}
