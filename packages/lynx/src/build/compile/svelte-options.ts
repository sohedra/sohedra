// `<svelte:options>` in a component: two options cannot work in a Lynx page.
//
// - `customRenderer={null}` makes Svelte compile the component as DOM code, which a Lynx page
//   cannot run (and the first frame's compile stops on it with an unclear error). A string names
//   another renderer module: that is Svelte's to read.
// - `css="injected"` writes the styles into the page with DOM code.

import { attributeValue, field, optionAttributes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { Pass } from "./pass.ts";

/** The value an attribute of `<svelte:options>` is written with, when it is a literal. */
function literalValue(attribute: AnyNode): unknown {
	const value = attributeValue(attribute);
	const only = value === true ? undefined : value[0];
	if (only?.type === "Text") return only.data;
	if (only?.type === "ExpressionTag") {
		const expression = field(only, "expression");
		if (expression?.type === "Literal") return expression.value;
	}
	return undefined;
}

/** Refuses the options that cannot work. */
export const svelteOptions: Pass = ({ source, filename, ast }) => {
	for (const attribute of optionAttributes(ast)) {
		if (attribute.type !== "Attribute") continue;
		const place = placeAt({ file: filename, text: source }, attribute.start!);
		if (attribute.name === "customRenderer" && literalValue(attribute) === null)
			throw buildError({ code: "renderer_option_off", details: {}, place });
		if (attribute.name === "css" && literalValue(attribute) === "injected")
			throw buildError({ code: "css_injected", details: {}, place });
	}
	return [];
};
