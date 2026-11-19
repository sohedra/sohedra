// Writes the model as declarations: flat interfaces, one per element, event and method map, with
// Lynx's doc comments. Nothing here is mapped or conditional, so the editor reads each element's
// attributes as written instead of computing them.

import { docComment, keyOf } from "./print.ts";
import type { EventField, Field, MethodModel, Model } from "./read.ts";

/** The interface name of a tag: `scroll-view` is `ScrollView`. */
export function pascalCase(tag: string): string {
	return tag.replace(/(?:^|-)([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** An attribute: optional ones also take `null`, which Svelte writes to remove one. */
function attribute(field: Field): string {
	const type = field.optional ? `${field.type} | null` : field.type;
	return `${docComment(field.doc)}${keyOf(field.name)}${field.optional ? "?" : ""}: ${type};`;
}

/** The doc of each spelling of an event attribute. */
function eventDocs(event: EventField): Record<string, string[]> {
	const name = `\`${event.name}\``;
	const own = event.doc.length > 0 ? event.doc : [`Lynx's ${name} event.`];
	const main = `, in a main-thread function`;
	return {
		[`on${event.name}`]: own,
		[`on${event.name}capture`]: [
			`${name}, heard in the capture phase: before the elements inside.`,
		],
		[`oncatch${event.name}`]: [`${name}, caught here: the elements this is inside do not hear it.`],
		[`oncatch${event.name}capture`]: [
			`${name}, caught in the capture phase: the elements inside do not hear it.`,
		],
		[`main-thread:on${event.name}`]: [`${name}${main}.`],
		[`main-thread:on${event.name}capture`]: [`${name}${main}, in the capture phase.`],
		[`main-thread:oncatch${event.name}`]: [`${name}${main}, caught here.`],
		[`main-thread:oncatch${event.name}capture`]: [`${name}${main}, caught in the capture phase.`],
	};
}

/** The eight attributes of an event, for an element whose tag type is `tag`. */
function eventAttributes(event: EventField, tag: string): string[] {
	const background = `LynxEventHandler<${event.event}<LynxNode, LynxNode<${tag}>>>`;
	const mainThread = `MainThreadEventHandler<${event.event}<MainThread.Element>>`;
	return Object.entries(eventDocs(event)).map(
		([name, doc]) =>
			`${docComment(doc)}${keyOf(name)}?: ${name.startsWith("main-thread:") ? mainThread : background};`,
	);
}

/** An event in an element's event map, by its name: its workaround tag stays on its attribute. */
function eventEntry(event: EventField, tag: string): string {
	const end = event.doc.findIndex((line) => line.startsWith("@workaround"));
	const doc =
		end === -1
			? event.doc
			: event.doc.slice(0, end).filter((line, i, all) => line || i < all.length - 1);
	return `${docComment(doc)}${keyOf(event.name)}: ${event.event}<LynxNode, LynxNode<${tag}>>;`;
}

/** A UI method in a method map: what it takes and what it resolves with. */
function method(model: MethodModel): string {
	const params = model.params ?? "{ [name: string]: never }";
	const key = model.required ? "params" : "params?";
	return `${docComment(model.doc)}${keyOf(model.name)}: { ${key}: ${params}; result: ${model.result} };`;
}

/** An interface, with its doc comment, members one to a line. */
function declaration(doc: readonly string[], head: string, members: readonly string[]): string {
	return `${docComment(doc)}export interface ${head} {\n${members.join("\n")}\n}`;
}

/** The text of `types/generated/elements.d.ts`, before formatting. */
export function writeElements(model: Model): string {
	const parts: string[] = [
		[
			`// Generated from @lynx-js/types ${model.version} by \`pnpm -F @sohedra/lynx generate\`. Do not edit:`,
			"// change scripts/types/ and generate again.",
			"//",
			"// Lynx's elements as a Svelte component writes them: each element's attributes, its events in",
			"// the binding's spellings, the events its listeners hear and its UI methods. The doc comments",
			"// are Lynx's, adapted from @lynx-js/types (Apache License 2.0).",
		].join("\n"),
		'import type { LynxElementAttributes, LynxEvent, LynxEventHandler, LynxNode, MainThread, MainThreadEventHandler } from "../elements.js";',
	];

	for (const { name, doc, body } of model.interfaces)
		parts.push(`${docComment(doc)}export interface ${name} ${body}`);

	for (const event of model.events) {
		const fields = event.fields.map((field) => attributeText(field, "readonly "));
		parts.push(
			declaration(
				event.doc,
				`${event.name}<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<Target, CurrentTarget>`,
				fields,
			),
		);
	}

	parts.push(
		declaration(
			["The attributes and events every element has."],
			"LynxCommonAttributes<Tag extends string = string> extends LynxElementAttributes<Tag>",
			[
				...model.common.attributes.map(attribute),
				...model.common.events.flatMap((event) => eventAttributes(event, "Tag")),
			],
		),
		declaration(
			["The events every element sends, by name, as its listeners hear them."],
			"LynxCommonEvents<Tag extends string = string>",
			model.common.events.map((event) => eventEntry(event, "Tag")),
		),
		declaration(
			[
				"The attributes and events most elements have as written here, and a few have their own of",
				"(`<input>`'s `focus` and `blur`).",
			],
			"LynxDefaultAttributes<Tag extends string = string>",
			[
				...model.defaults.attributes.map(attribute),
				...model.defaults.events.flatMap((event) => eventAttributes(event, "Tag")),
			],
		),
		declaration(
			["The events of `LynxDefaultAttributes`, by name, as their listeners hear them."],
			"LynxDefaultEvents<Tag extends string = string>",
			model.defaults.events.map((event) => eventEntry(event, "Tag")),
		),
	);

	for (const element of model.elements) {
		const name = pascalCase(element.tag);
		const tag = JSON.stringify(element.tag);
		const base = !element.common
			? `LynxElementAttributes<${tag}>`
			: element.defaults
				? `LynxCommonAttributes<${tag}>, LynxDefaultAttributes<${tag}>`
				: `LynxCommonAttributes<${tag}>`;
		const events = !element.common
			? `${name}Events`
			: element.defaults
				? `${name}Events extends LynxCommonEvents<${tag}>, LynxDefaultEvents<${tag}>`
				: `${name}Events extends LynxCommonEvents<${tag}>`;
		parts.push(
			declaration(
				element.doc.length > 0
					? element.doc
					: [`The attributes and events of \`<${element.tag}>\`.`],
				`${name}Attributes extends ${base}`,
				[
					...element.attributes.map(attribute),
					...element.events.flatMap((event) => eventAttributes(event, tag)),
				],
			),
			declaration(
				[`The events \`<${element.tag}>\` sends, by name, as its listeners hear them.`],
				events,
				element.events.map((event) => eventEntry(event, tag)),
			),
		);
	}

	parts.push(
		declaration(
			["Every element, by tag: what a component may write on it."],
			"LynxElements",
			model.elements.map(({ tag }) => `${keyOf(tag)}: ${pascalCase(tag)}Attributes;`),
		),
		declaration(
			["The events of every element, by tag."],
			"LynxElementEvents",
			model.elements.map(({ tag }) => `${keyOf(tag)}: ${pascalCase(tag)}Events;`),
		),
		declaration(
			["The UI methods every element has, for `invoke`: what each takes and resolves with."],
			"LynxCommonMethods",
			model.methods.common.map(method),
		),
	);
	for (const { tag, methods } of model.methods.byTag)
		parts.push(
			declaration(
				[`The UI methods of \`<${tag}>\`.`],
				`${pascalCase(tag)}Methods extends LynxCommonMethods`,
				methods.map(method),
			),
		);
	const names = [
		...model.methods.common.map((m) => m.name),
		...model.methods.byTag.flatMap(({ methods }) => methods.map((m) => m.name)),
	];
	parts.push(
		declaration(
			["The UI methods of the elements that have their own, by tag."],
			"LynxElementMethods",
			model.methods.byTag.map(({ tag }) => `${keyOf(tag)}: ${pascalCase(tag)}Methods;`),
		),
		`/** The name of every UI method Lynx's types know. */\nexport type LynxMethodName = ${[
			...new Set(names),
		]
			.sort()
			.map((name) => JSON.stringify(name))
			.join(" | ")};`,
	);
	return `${parts.join("\n\n")}\n`;
}

/** A field as `name?: type;`, with its doc. */
function attributeText(field: Field, modifier = ""): string {
	return `${docComment(field.doc)}${modifier}${keyOf(field.name)}${field.optional ? "?" : ""}: ${field.type};`;
}

/** The text of `src/background/host/system-info.ts`, before formatting. */
export function writeSystemInfo(model: Model, notes: Readonly<Record<string, string>>): string {
	const { systemInfo } = model;
	// A note goes after Lynx's description, before its tags.
	const withNote = (doc: readonly string[], name: string): string[] => {
		const note = notes[name];
		if (!note) return [...doc];
		const tags = doc.findIndex((line) => line.startsWith("@"));
		const at = tags === -1 ? doc.length : tags;
		return [...doc.slice(0, at), note, ...doc.slice(at)];
	};
	return `${[
		[
			`// Generated from @lynx-js/types ${model.version} by \`pnpm -F @sohedra/lynx generate\`. Do not edit:`,
			"// change scripts/types/ and generate again. The doc comments are Lynx's, adapted from",
			"// @lynx-js/types (Apache License 2.0).",
		].join("\n"),
		`/** The platforms Lynx runs on. \`pc\` is Lynx's older name for Windows and macOS. */\nexport type PlatformType = ${systemInfo.platforms};`,
		declaration(
			withNote(systemInfo.doc, ""),
			"SystemInfo",
			systemInfo.fields.map((field) =>
				attributeText({ ...field, doc: withNote(field.doc, field.name) }, "readonly "),
			),
		),
	].join("\n\n")}\n`;
}
