// Writes the model as an editor's HTML custom data (`html.customData`): each element with its
// attributes and the binding's spelling of its events, and Lynx's doc as their hovers. The editor
// reads it for the markup of a `.svelte` file, where the element types reach only through
// svelte-check.

import type { EventField, Field, Model } from "./read.ts";

/** A hover's text: Markdown. */
interface Description {
	kind: "markdown";
	value: string;
}

interface CustomAttribute {
	name: string;
	description?: Description;
	values?: { name: string }[];
}

interface CustomTag {
	name: string;
	description?: Description;
	attributes: CustomAttribute[];
}

/** A doc as a hover: its text before the tags (`@workaround`, `@defaultValue`), lines joined. */
function description(doc: readonly string[]): Description | undefined {
	const end = doc.findIndex((line) => line.startsWith("@"));
	const value = (end === -1 ? doc : doc.slice(0, end)).join("\n").trim();
	return value ? { kind: "markdown", value } : undefined;
}

/** The values a completion offers: those of a union of quoted words, as `"auto" | "none"` is. */
function valuesOf(type: string): { name: string }[] | undefined {
	const members = type.split("|").map((member) => member.trim());
	if (!members.every((member) => /^"[^"]*"$/.test(member))) return undefined;
	return members.map((member) => ({ name: JSON.parse(member) as string }));
}

function attribute(field: Field): CustomAttribute {
	const hover = description(field.doc);
	const values = valuesOf(field.type);
	return { name: field.name, ...(hover && { description: hover }), ...(values && { values }) };
}

/** An event as a component writes it: `on` and its name, with its doc. */
function event(field: EventField): CustomAttribute {
	const hover = description(field.doc.length > 0 ? field.doc : [`Lynx's \`${field.name}\` event.`]);
	return { name: `on${field.name}`, ...(hover && { description: hover }) };
}

/** The text of `types/generated/html-custom-data.json`, before formatting. */
export function writeCustomData(model: Model): string {
	const tags: CustomTag[] = model.elements.map((element) => {
		const hover = description(element.doc);
		const own = element.defaults
			? {
					attributes: [...model.defaults.attributes, ...element.attributes],
					events: [...model.defaults.events, ...element.events],
				}
			: element;
		return {
			name: element.tag,
			...(hover && { description: hover }),
			attributes: [...own.attributes.map(attribute), ...own.events.map(event)],
		};
	});
	const data = {
		version: 1.1,
		tags,
		globalAttributes: [
			...model.common.attributes.map(attribute),
			...model.common.events.map(event),
		],
	};
	return `${JSON.stringify(data, null, "\t")}\n`;
}
