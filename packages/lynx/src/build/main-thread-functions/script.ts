// The main-thread functions of a component's scripts and of a plain module, as edits against
// the text as written.

import path from "node:path";

import { scriptParser, scriptProgram } from "../../svelte/build/index.ts";
import type { ComponentAst } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { SourceText } from "../diagnostics/messages.ts";
import { applyEdits } from "../source-map/edits.ts";
import type { Edit, Piece } from "../source-map/edits.ts";
import type { SourceMap } from "../source-map/maps.ts";
import { hasMainThreadFunction } from "./directive.ts";
import { emitFunctions, FOOTER_END, FOOTER_START } from "./emit.ts";
import type { Hoisted } from "./emit.ts";
import { findFunctions } from "./find.ts";
import type { Fail } from "./find.ts";
import { inlineFunctions } from "./inline.ts";
import { COMPILED_NAMES } from "./names.ts";
import type { Node } from "./node.ts";

/** What compiling main-thread functions reads, besides the text. */
export interface FunctionOptions {
	filename: string;
	thread: Thread;
	/** A development build: a called capture that is a plain function is an error. */
	development: boolean;
	/** The app's folder, which the ids are made relative to. */
	root: string;
}

/** The main-thread functions of a component. */
export interface ComponentFunctions {
	/** Against the component as written. */
	edits: Edit[];
	/** The registrations of the bodies with the footer around them, to follow the compiled module (main thread). */
	registrations: Piece[];
	/** The ids of the functions, in source order. */
	ids: string[];
}

/** The error for a function that cannot be a main-thread function, at its place in `source`. */
function failIn(source: SourceText): Fail {
	return (node, failure) => {
		throw buildError({ ...failure, place: placeAt(source, node.start) });
	};
}

/** The registrations with the footer that loads the runtime for them, or nothing. */
function withFooter(registrations: Piece[]): Piece[] {
	const first = registrations[0];
	if (first === undefined || !("at" in first)) return [];
	const at = first.at;
	return [{ text: FOOTER_START, at }, ...registrations, { text: FOOTER_END, at }];
}

/**
 * The main-thread functions in a component's scripts, and in its markup (a function written in the
 * markup moves into the instance script). Both threads read the same text, so they agree on the ids.
 */
export function componentFunctions(
	options: FunctionOptions & { source: string; ast: ComponentAst },
): ComponentFunctions | undefined {
	const { source, ast, filename } = options;
	if (!hasMainThreadFunction(source)) return undefined;
	const text: SourceText = { file: filename, text: source };
	const fail = failIn(text);
	const inline = inlineFunctions(ast);
	const hoisted = new Map<Node, Hoisted>();
	const synthetic: Node[] = [];
	const declared: string[] = [];
	for (const [index, item] of inline.entries()) {
		if (item.blockNames.length > 0)
			throw buildError({
				code: "main_thread_function_block_name",
				details: { where: item.where, names: item.blockNames },
				place: placeAt(text, item.expression.start),
			});
		const name = `${COMPILED_NAMES.hoisted}${index}`;
		hoisted.set(item.expression, { name });
		declared.push(`\nconst ${name} = ${source.slice(item.expression.start, item.expression.end)};`);
		// The script's declaration of it, for the walk: a constant at the top.
		synthetic.push({
			type: "VariableDeclaration",
			kind: "const",
			declarations: [
				{
					type: "VariableDeclarator",
					id: { type: "Identifier", name },
					init: item.expression,
				},
			],
		});
	}

	const edits: Edit[] = [];
	const registrations: Piece[] = [];
	const ids: string[] = [];
	// The scripts the walk reads: the module script, and the instance script with the markup's
	// functions declared at its end (a new one, if the component has none).
	const scripts: { program: Node; instance: boolean; text: string; existing: boolean }[] = [];
	const module = scriptProgram(ast.module);
	if (module) {
		const content = module;
		scripts.push({
			program: content,
			instance: false,
			text: source.slice(content.start, content.end),
			existing: true,
		});
	}
	if (ast.instance || synthetic.length > 0) {
		const content: Node = scriptProgram(ast.instance) ?? { type: "Program", body: [] };
		scripts.push({
			program: { ...content, body: [...content.body, ...synthetic] },
			instance: true,
			text: (ast.instance ? source.slice(content.start, content.end) : "") + declared.join(""),
			existing: Boolean(ast.instance),
		});
	}
	for (const { program, instance, text: scriptText, existing } of scripts) {
		const outer = instance ? module : undefined;
		const functions = findFunctions({ program, instance, fail, outer });
		if (functions.found.length === 0) continue;
		const emitted = emitFunctions({
			...options,
			source,
			script: scriptText,
			instance,
			functions,
			hoisted,
		});
		edits.push(...emitted.edits);
		registrations.push(...emitted.registrations);
		ids.push(...emitted.ids);
		if (existing) {
			// What the script needs goes at its end.
			const end: number = program.end;
			const pieces: Piece[] = [...emitted.declarations];
			if (emitted.declarations.length > 0) pieces.push({ text: "\n", at: end });
			pieces.push({ text: emitted.imports, at: end });
			edits.push({ start: end, end, pieces });
		} else {
			const at = source.length;
			edits.push({
				start: at,
				end: at,
				pieces: [
					{ text: '\n<script lang="ts">', at },
					...emitted.declarations,
					{ text: emitted.imports, at },
					{ text: "\n</script>\n", at },
				],
			});
		}
	}
	if (ids.length === 0) return undefined;
	return { edits, registrations: withFooter(registrations), ids };
}

/** A plain module with its main-thread functions compiled. */
export interface ModuleFunctions {
	code: string;
	/** From `code` to the module as written, when asked for. */
	map: SourceMap | undefined;
	/** The ids of the functions, in source order. */
	ids: string[];
}

/** Whether a module is written in TypeScript, by its file name. */
const isTypeScript = (filename: string): boolean => /\.[mc]?tsx?$/.test(filename);

/** Parse a plain module; a syntax error is the build's, at its place. */
function parseModule(source: SourceText, root: string): Node {
	try {
		return scriptParser(root)(source.text, isTypeScript(source.file));
	} catch (error) {
		// Boundary: a thrown value is unknown; the parser's errors carry a position and a message.
		const { pos, message } = error as { pos?: number; message: string };
		if (pos === undefined) throw error;
		// acorn ends its messages with the place: " (3:14)".
		throw buildError({
			code: "script_syntax_error",
			details: { reason: message.replace(/ \(\d+:\d+\)$/, "") },
			place: placeAt(source, pos),
		});
	}
}

/**
 * Compile a plain module's main-thread functions for one thread; on the main thread the module
 * ends with the registrations of their bodies. With `sourceMap`, also a map to `source`.
 */
export function moduleFunctions(
	source: string,
	options: FunctionOptions & { sourceMap: boolean },
): ModuleFunctions {
	const unchanged: ModuleFunctions = { code: source, map: undefined, ids: [] };
	if (!hasMainThreadFunction(source)) return unchanged;
	const { filename, root } = options;
	const text: SourceText = { file: filename, text: source };
	const program = parseModule(text, root);
	const functions = findFunctions({ program, instance: false, fail: failIn(text) });
	if (functions.found.length === 0) return unchanged;
	const emitted = emitFunctions({
		...options,
		source,
		script: source,
		instance: false,
		functions,
		hoisted: new Map(),
	});
	const at = source.length;
	const tail: Piece[] = [{ text: emitted.imports, at }, ...withFooter(emitted.registrations)];
	const edits = [...emitted.edits, { start: at, end: at, pieces: tail }];
	const edited = applyEdits(source, edits);
	const map = options.sourceMap ? edited.map(path.basename(filename)) : undefined;
	return { code: edited.code, map, ids: emitted.ids };
}
