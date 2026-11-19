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
import { stringLiteral } from "../string-literal.ts";
import { writeCaptures } from "./captures.ts";
import type { Copy, Guard } from "./captures.ts";
import type { Found, ScriptFunctions } from "./find.ts";
import type { Hoisting } from "./hoisting.ts";
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
	/** The function declarations made at the top of their scope. */
	hoisting: Hoisting;
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
	/** What the script imports from the binding for its functions, if they need anything. */
	imports: string;
}

/**
 * The expression that throws when a captured value that the body calls is a plain function, or is
 * a plain object or a namespace whose member that the body calls is one.
 */
function guardFor(options: EmitOptions, fn: Found): Guard | undefined {
	const { called, calledMembers } = fn;
	// A main-thread function of this script is an object by the time it is called, not a plain function.
	const own = new Set<string>();
	for (const { node, parent } of options.functions.found) {
		const name = node.type === "FunctionDeclaration" ? node.id?.name : parent?.id?.name;
		if (name !== undefined) own.add(name);
	}
	const direct = new Set([...called.keys()].filter((name) => !own.has(name)));
	const names = new Set([...direct, ...calledMembers.keys()]);
	if (names.size === 0) return undefined;
	/** The error for the plain function `name`, called at `at`. */
	const error = (name: string, at: Node): string => {
		const message = describe({
			code: "plain_function_in_main_thread_function",
			details: { name },
			// The path under the app, so two checkouts of one app give one development bundle.
			place: placeAt(
				{ file: pathInApp(options.filename, options.root), text: options.source },
				at.start,
			),
		});
		return `new Error(${stringLiteral(message)})`;
	};
	return {
		names,
		wrap: (name, value) => {
			const members = calledMembers.get(name);
			if (members === undefined)
				return `typeof ${value} === "function" ? (() => { throw ${error(name, called.get(name)!)}; })() : ${value}`;
			const checks: string[] = [];
			if (direct.has(name))
				checks.push(`if (typeof __value === "function") throw ${error(name, called.get(name)!)};`);
			const plain = `__value !== null && typeof __value === "object" && [null, Object.prototype].includes(Object.getPrototypeOf(__value))`;
			const methods = [...members].map(
				([member, at]) =>
					`if (typeof __value[${stringLiteral(member)}] === "function") throw ${error(`${name}.${member}`, at)};`,
			);
			checks.push(`if (${plain}) { ${methods.join(" ")} }`);
			return `((__value) => { ${checks.join(" ")} return __value; })(${value})`;
		},
	};
}

/**
 * How the captured `$state` names of a function that follows its captures are copied: through the
 * binding's copy, told in development what each is called and where its function is.
 */
function copyFor(options: EmitOptions, fn: Found, toCopy: string): Copy {
	let where: string | undefined;
	return {
		names: options.functions.deepState,
		wrap: (value, name) => {
			if (!options.development) return `${toCopy}(${value})`;
			// The path under the app, so two checkouts of one app give one development bundle.
			where ??= placeAt(
				{ file: pathInApp(options.filename, options.root), text: options.source },
				fn.node.start,
			).where;
			return `${toCopy}(${value}, { name: ${stringLiteral(name)}, where: ${stringLiteral(where)} })`;
		},
	};
}

/**
 * Write the object of a named function declaration: `let name = {…}`, or `export const` for an
 * exported one (Svelte refuses `export let` in a component), or `const name = {…}` before
 * `export default name` for a default export. At the top of its scope, when it is hoisted.
 */
function declaration(
	{ node, parent }: Found,
	object: string,
	hoisting: Hoisting,
	write: { tops: Map<Node, Edit>; edits: Edit[] },
): void {
	const { tops, edits } = write;
	const { name } = node.id;
	const exported = parent?.type === "ExportNamedDeclaration";
	const isDefault = parent?.type === "ExportDefaultDeclaration";
	const written = `${exported ? "export const" : isDefault ? "const" : "let"} ${name} = ${object};`;
	const range = exported || isDefault ? parent : node;
	const rest = isDefault ? `export default ${name};` : "";
	const top = hoisting.at.get(node);
	if (top === undefined) {
		edits.push({
			start: range.start,
			end: range.end,
			text: rest ? `${written}\n${rest}` : written,
		});
		return;
	}
	tops.set(node, { start: top, end: top, pieces: [{ text: `\n${written}`, at: node.start }] });
	edits.push({ start: range.start, end: range.end, text: rest });
}

/** Write the script's main-thread functions for `options.thread`. */
export function emitFunctions(options: EmitOptions): Emitted {
	const { source, thread, instance, functions, hoisted } = options;
	const prefix = idPrefix(options);
	const toHandle = `__transformToWorklet_${hash(options.script, 5)}`;
	const toCopy = `__copyCapture_${hash(options.script, 5)}`;
	const background = thread === "background";
	const emitted: Emitted = { edits: [], declarations: [], registrations: [], ids: [], imports: "" };
	/** What a declaration made at the top of its scope writes there, by its node. */
	const tops = new Map<Node, Edit>();
	let anyHandle = false;
	let anyCopy = false;

	for (const fn of functions.found) {
		const { node, parent, captures, handles } = fn;
		const id = prefix + (emitted.ids.length + 1);
		emitted.ids.push(id);
		const handleNames = handles.map((_, index) => `_jsFn${index + 1}`);
		anyHandle ||= handles.length > 0;

		// The object, on both threads.
		const follows = instance && background && captures.size > 0 && functions.topLevel.has(node);
		const parts: string[] = [];
		if (captures.size > 0) {
			const guard = options.development && background ? guardFor(options, fn) : undefined;
			const copy = follows ? copyFor(options, fn, toCopy) : undefined;
			const written = writeCaptures(captures, { copy, guard });
			anyCopy ||= written.includes(toCopy);
			parts.push(`${FUNCTION_FIELDS.captures}: ${written}`);
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
		} else if (node.type === "FunctionDeclaration" && node.id) {
			declaration(fn, object, options.hoisting, { tops, edits: emitted.edits });
		} else {
			if (parent?.type === "ExportDefaultDeclaration") {
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
		const name = fn.callsItself.size > 0 ? SELF : "";
		const async = node.async ? "async " : "";
		const params = (): void => {
			if (node.params.length > 0) copy(node.params[0].start, node.params.at(-1).end);
		};
		let unpack = "";
		for (const self of fn.callsItself) unpack += `const ${self} = ${SELF}.bind(this);\n`;
		if (handles.length > 0)
			unpack += `let { ${handleNames.join(", ")} } = this[${JSON.stringify(FUNCTION_FIELDS.background)}];\n`;
		if (captures.size > 0)
			unpack += `let { ${[...captures.keys()].join(", ")} } = this[${JSON.stringify(FUNCTION_FIELDS.captures)}];\n`;
		say(`${REGISTER_FUNCTION}("main-thread", ${JSON.stringify(id)}, `);
		if (fn.parametersRead) {
			// The defaults run before the body: the function as written runs inside, once the names
			// it reads are unpacked.
			say(`function ${name}() {\n${unpack}return (${async}function (`);
			params();
			say(") {");
			copy(node.body.start + 1, node.body.end - 1);
			say("}).apply(this, arguments);\n});\n");
		} else {
			say(`${async}function ${name}(`);
			params();
			say(`) {\n${unpack}`);
			copy(node.body.start + 1, node.body.end - 1);
			say("});\n");
		}
	}

	// Before the other edits: one may start where a declaration is made.
	emitted.edits.unshift(...options.hoisting.order.map((node) => tops.get(node)!));
	if (background && anyHandle)
		emitted.imports += `\nimport { ${FUNCTION_RUNTIME.handle} as ${toHandle} } from ${JSON.stringify(MAIN_THREAD_FUNCTIONS_ENTRY)};\n`;
	if (background && anyCopy)
		emitted.imports += `\nimport { ${FUNCTION_RUNTIME.copy} as ${toCopy} } from ${JSON.stringify(MAIN_THREAD_FUNCTIONS_ENTRY)};\n`;
	return emitted;
}
