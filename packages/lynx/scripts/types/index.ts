// The types generated from `@lynx-js/types`: Lynx's elements as a Svelte component writes them,
// `SystemInfo`, the global `lynx`, and the elements as the editor's HTML custom data. They are
// committed, since they are the binding's API: a move to a new `@lynx-js/types` shows as a diff to
// review, and a test fails while the committed files differ from what this makes.

import { format } from "oxfmt";

import {
	ADDED_ATTRIBUTES,
	ADDED_EVENTS,
	EVENT_DOCS,
	OMITTED_TAGS,
	OPTIONAL_ATTRIBUTES,
	REPLACED_ATTRIBUTES,
	SYSTEM_INFO_NOTES,
} from "./additions.ts";
import { writeCustomData } from "./custom-data.ts";
import { writeLynx } from "./lynx.ts";
import { readLynxTypes } from "./read.ts";
import type { ElementModel, Model } from "./read.ts";
import { writeElements, writeSystemInfo } from "./write.ts";

export { OMITTED_TAGS } from "./additions.ts";
export { readLynxTypes } from "./read.ts";

/** A generated file: its path from the package's folder, and its text. */
export interface GeneratedFile {
	path: string;
	text: string;
}

/** The element with this tag. */
function element(model: Model, tag: string): ElementModel {
	const found = model.elements.find((candidate) => candidate.tag === tag);
	if (!found) throw new Error(`@lynx-js/types no longer has <${tag}>.`);
	return found;
}

/**
 * The model with the binding's changes: what Svelte writes itself goes, and the additions come in.
 * Throws when Lynx's types already declare an addition, which can go then.
 */
export function withAdditions(model: Model): Model {
	const kept = (field: { name: string }) => !REPLACED_ATTRIBUTES.has(field.name);
	model.common.attributes = model.common.attributes.filter(kept);
	for (const each of model.elements) each.attributes = each.attributes.filter(kept);
	for (const { tag, name } of OPTIONAL_ATTRIBUTES) {
		const field = element(model, tag).attributes.find((candidate) => candidate.name === name);
		if (!field) throw new Error(`@lynx-js/types no longer has ${name} on <${tag}>.`);
		field.optional = true;
	}
	for (const { tag, name, type, doc } of ADDED_ATTRIBUTES) {
		const own = element(model, tag);
		if ([...model.common.attributes, ...own.attributes].some((field) => field.name === name))
			throw new Error(
				`@lynx-js/types now declares ${name} on <${tag}>: remove it from scripts/types/additions.ts.`,
			);
		own.attributes.push({ name, optional: true, type, doc });
	}
	for (const { tag, name, event, doc } of ADDED_EVENTS) {
		const own = element(model, tag);
		if ([...model.common.events, ...own.events].some((field) => field.name === name))
			throw new Error(
				`@lynx-js/types now declares the ${name} event on <${tag}>: remove it from scripts/types/additions.ts.`,
			);
		own.events.push({ name, event, doc });
	}
	for (const { tag, name, doc } of EVENT_DOCS) {
		const event = element(model, tag).events.find((candidate) => candidate.name === name);
		if (!event) throw new Error(`@lynx-js/types no longer has the ${name} event on <${tag}>.`);
		event.doc = doc;
	}
	return model;
}

/** Formats generated text as the repository's formatter does. */
async function formatted(path: string, text: string): Promise<string> {
	const { code, errors } = await format(path, text, { useTabs: true, sortImports: true });
	if (errors.length > 0) throw new Error(`${path} does not parse: ${errors[0]!.message}`);
	return code;
}

/** Every generated file, as `pnpm -F @sohedra/lynx generate` writes it. */
export async function generateTypes(): Promise<GeneratedFile[]> {
	const model = withAdditions(readLynxTypes(OMITTED_TAGS));
	const files = [
		{ path: "types/generated/elements.d.ts", text: writeElements(model) },
		{ path: "src/background/host/system-info.ts", text: writeSystemInfo(model, SYSTEM_INFO_NOTES) },
		{ path: "types/generated/html-custom-data.json", text: writeCustomData(model) },
		{ path: "types/generated/lynx.d.ts", text: writeLynx() },
	];
	return Promise.all(
		files.map(async ({ path, text }) => ({ path, text: await formatted(path, text) })),
	);
}
