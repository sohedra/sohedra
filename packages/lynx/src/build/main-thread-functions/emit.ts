// What the build writes for a script's main-thread functions. On both threads an object stands in
// the function's place:
//
//   { _c: { captured values }, _wkltId: "id", _jsFn: { handles to background functions } }
//
// and on the main thread the function's body is also registered under that id. The runtime runs
// the body with the object as `this`, so the body starts by unpacking `this._c`. All of it is
// written as edits against the text as written, so the body is copied as it was, types included:
// whatever compiles the file next removes them.

import {
	FIRST_FRAME_HANDLE,
	FUNCTION_FIELDS,
	FUNCTION_RUNTIME,
	MAIN_THREAD_FUNCTIONS_ENTRY,
	REGISTER_FUNCTION,
} from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import { describe, placeAt } from "../diagnostics/messages.ts";
import type { Edit, Piece } from "../source-map/edits.ts";
import { writeCaptures } from "./captures.ts";
import type { Guard } from "./captures.ts";
import type { ScriptFunctions } from "./find.ts";
import { hash, idPrefix, pathInApp } from "./ids.ts";
import type { Node } from "./node.ts";

/** The name a registered body gives itself, when it calls itself by its own name. */
const SELF = "__mainThreadFunction";
const LOAD_RUNTIME = "__svelteLynxLoadWorkletRuntime";

/** What follows a main thread's module: the registrations, if the runtime for them is there. */
export const FOOTER_START: string =
	`\nimport { ${FUNCTION_RUNTIME.load} as ${LOAD_RUNTIME} } from ${JSON.stringify(MAIN_THREAD_FUNCTIONS_ENTRY)};\n` +
	`if (${LOAD_RUNTIME}()) {\n`;
export const FOOTER_END = "}\n";

/** A main-thread function that is written in the markup: it is declared in the script instead. */
export interface Hoisted {
	/** The name the markup uses for it, and the script declares. */
	name: string;
}

/** What `emitFunctions` reads. */
export interface EmitOptions {
	/** The text every position counts in. */
	source: string;
	filename: string;
	thread: Thread;
	/** A development build: a called capture that is a plain function is an error. */
	development: boolean;
	root: string;
	/** The text of the script as written, for the ids (with the markup functions hoisted into it). */
	script: string;
	/** The script is a component's instance script. */
	instance: boolean;
	functions: ScriptFunctions;
	/** The functions written in the markup, by their nodes. */
	hoisted: Map<Node, Hoisted>;
}

/** What a script's main-thread functions are written as. */
export interface Emitted {
	/** The functions replaced by their objects, and the markup functions by their names. */
	edits: Edit[];
	/** The declarations of the hoisted functions. */
	declarations: Piece[];
	/** The registrations of the bodies, on the main thread. */
	registrations: Piece[];
	/** The ids of the functions, in source order. */
	ids: string[];
	/** What the script imports to turn background functions into handles, if any is used. */
	imports: string;
}

/** The expression that throws when a captured value that the body calls is a plain function. */
function guardFor(options: EmitOptions, called: Map<string, Node>): Guard | undefined {
	// A main-thread function of this script is an object by the time it is called, not a plain function.
	const own = new Set<string>();
	for (const { node, parent } of options.functions.found) {
		const name = node.type === "FunctionDeclaration" ? node.id?.name : parent?.id?.name;
		if (name !== undefined) own.add(name);
	}
	const names = new Set([...called.keys()].filter((name) => !own.has(name)));
	if (names.size === 0) return undefined;
	return {
		names,
		wrap: (name, value) => {
			const callee = called.get(name)!;
			const message = describe({
				code: "plain_function_in_main_thread_function",
				details: { name },
				// The path under the app, so two checkouts of one app give one development bundle.
				place: placeAt(
					{ file: pathInApp(options.filename, options.root), text: options.source },
					callee.start,
				),
			});
			return `typeof ${value} === "function" ? (() => { throw new Error(${JSON.stringify(message)}); })() : ${value}`;
		},
	};
}

/** Write the script's main-thread functions for `options.thread`. */
export function emitFunctions(options: EmitOptions): Emitted {
	const { source, thread, instance, functions, hoisted } = options;
	const prefix = idPrefix(options);
	const toHandle = `__transformToWorklet_${hash(options.script, 5)}`;
	const background = thread === "background";
	const emitted: Emitted = { edits: [], declarations: [], registrations: [], ids: [], imports: "" };
	let anyHandle = false;

	for (const fn of functions.found) {
		const { node, parent, captures, handles, called } = fn;
		const id = prefix + (emitted.ids.length + 1);
		emitted.ids.push(id);
		const handleNames = handles.map((_, index) => `_jsFn${index + 1}`);
		anyHandle ||= handles.length > 0;

		// The object, on both threads.
		const follows = instance && background && captures.size > 0 && functions.topLevel.has(node);
		const parts: string[] = [];
		if (captures.size > 0) {
			const guard =
				options.development && background && called.size > 0
					? guardFor(options, called)
					: undefined;
			const deepState = follows ? functions.deepState : undefined;
			parts.push(`${FUNCTION_FIELDS.captures}: ${writeCaptures(captures, { deepState, guard })}`);
		}
		parts.push(`${FUNCTION_FIELDS.id}: ${JSON.stringify(id)}`);
		if (handles.length > 0) {
			const entries = handles.map((argument, index) => {
				const value = background
					? `${toHandle}(${source.slice(argument.start, argument.end)})`
					: FIRST_FRAME_HANDLE;
				return `${handleNames[index]}: ${value}`;
			});
			parts.push(`${FUNCTION_FIELDS.background}: { ${entries.join(", ")} }`);
		}
		let object = `{ ${parts.join(", ")} }`;
		if (follows) object = `$derived(${object})`;

		const markup = hoisted.get(node);
		if (markup !== undefined) {
			// Where the function was written, its name; in the script, its declaration.
			emitted.edits.push({ start: node.start, end: node.end, text: markup.name });
			emitted.declarations.push({ text: `\nconst ${markup.name} = ${object};`, at: node.start });
		} else {
			const isDefault = parent?.type === "ExportDefaultDeclaration";
			if (node.type === "FunctionDeclaration" && !isDefault) {
				object = `let ${node.id.name} = ${object};`;
			} else if (isDefault) {
				object += ";";
			} else if (
				parent?.type === "ExpressionStatement" ||
				(parent?.type === "ArrowFunctionExpression" && parent.body === node)
			) {
				// Where a `{` would start a block.
				object = `(${object})`;
			}
			emitted.edits.push({ start: node.start, end: node.end, text: object });
		}

		if (background) continue;
		// The registration: the function as written, after unpacking `this`.
		const say = (text: string): void => {
			emitted.registrations.push({ text, at: node.start });
		};
		const copy = (from: number, to: number): void => {
			let cursor = from;
			handles.forEach((argument, index) => {
				if (argument.start < from || argument.start >= to) return;
				emitted.registrations.push({ copy: [cursor, argument.start] });
				say(handleNames[index]!);
				cursor = argument.end;
			});
			emitted.registrations.push({ copy: [cursor, to] });
		};
		say(
			`${REGISTER_FUNCTION}("main-thread", ${JSON.stringify(id)}, ` +
				`${node.async ? "async " : ""}function ${fn.callsItself ? SELF : ""}(`,
		);
		if (node.params.length > 0) copy(node.params[0].start, node.params.at(-1).end);
		let unpack = ") {\n";
		if (fn.callsItself) unpack += `const ${fn.self} = ${SELF}.bind(this);\n`;
		if (handles.length > 0)
			unpack += `let { ${handleNames.join(", ")} } = this[${JSON.stringify(FUNCTION_FIELDS.background)}];\n`;
		if (captures.size > 0)
			unpack += `let { ${[...captures.keys()].join(", ")} } = this[${JSON.stringify(FUNCTION_FIELDS.captures)}];\n`;
		say(unpack);
		copy(node.body.start + 1, node.body.end - 1);
		say("});\n");
	}

	if (background && anyHandle)
		emitted.imports = `\nimport { ${FUNCTION_RUNTIME.handle} as ${toHandle} } from ${JSON.stringify(MAIN_THREAD_FUNCTIONS_ENTRY)};\n`;
	return emitted;
}
