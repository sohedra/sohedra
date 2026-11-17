// What the compile step for main-thread functions wrote, read back from its output: each
// function's object (`{ _wkltId, _c, _jsFn }`) and the ids whose bodies are registered with the
// main thread's runtime.

import { stripTypeScriptTypes } from "node:module";

import { scriptParser } from "../../../../src/svelte/build/index.ts";
import { APP_ROOT } from "../app.ts";

// ESTree nodes, walked by shape.
// oxlint-disable-next-line typescript/no-explicit-any -- AST nodes are read by whichever fields each type has
type Node = any;

/** A main-thread function's object, as read back. */
export interface FunctionObject {
	id: string;
	/** The captured names; a narrowed member is its path (`settings.size.width`). */
	captures: string[];
	/** How many background functions it may call (`runOnBackground`). */
	backgroundFunctions: number;
	/** The keys of the object besides the ones the build writes. */
	extraKeys: string[];
}

/** The functions and registrations of one compiled module. */
export interface Output {
	functions: FunctionObject[];
	/** The ids whose bodies are registered, in order. */
	registrations: string[];
}

/** What the build itself puts on a main-thread function's object. */
const OWN_KEYS = new Set(["_wkltId", "_c", "_jsFn"]);

/**
 * `code` as JavaScript. The compile step leaves a script's types where they were written:
 * whatever compiles the file next removes them (SWC, in a build; Node's own remover here, which
 * keeps every line and column).
 */
export function withoutTypes(code: string): string {
	// Node warns that its remover is experimental, once per process.
	const emitWarning = process.emitWarning;
	process.emitWarning = () => {};
	try {
		return stripTypeScriptTypes(code);
	} finally {
		process.emitWarning = emitWarning;
	}
}

const keyOf = (property: Node): string => String(property.key.name ?? property.key.value);
const property = (object: Node, name: string): Node =>
	object.properties.find((entry: Node) => entry.type === "Property" && keyOf(entry) === name);

/** The names in a captured-values object: nested objects are member paths. */
function captured(object: Node, prefix = ""): string[] {
	return object.properties.flatMap((entry: Node) => {
		if (entry.type !== "Property") return [`${prefix}...`];
		const name = prefix + keyOf(entry);
		return entry.value.type === "ObjectExpression" ? captured(entry.value, `${name}.`) : [name];
	});
}

/** Every main-thread function object and registration in `code`, in source order. */
export function readOutput(code: string): Output {
	const output: Output = { functions: [], registrations: [] };
	const visit = (node: Node): void => {
		if (!node || typeof node.type !== "string") return;
		if (node.type === "ObjectExpression") {
			const id = property(node, "_wkltId");
			if (id?.value.type === "Literal") {
				const values = property(node, "_c");
				const background = property(node, "_jsFn");
				output.functions.push({
					id: id.value.value,
					captures: values ? captured(values.value) : [],
					backgroundFunctions: background ? background.value.properties.length : 0,
					extraKeys: node.properties
						.filter((entry: Node) => entry.type === "Property")
						.map(keyOf)
						.filter((key: string) => !OWN_KEYS.has(key)),
				});
			}
		}
		if (
			node.type === "CallExpression" &&
			node.callee.type === "Identifier" &&
			node.callee.name === "registerWorkletInternal"
		) {
			output.registrations.push(String(node.arguments[1].value));
			// The body is the function as written: nothing of the compile step's inside.
			return;
		}
		for (const key in node) {
			if (key === "loc" || key === "typeAnnotation") continue;
			const child = node[key];
			if (Array.isArray(child)) for (const item of child) visit(item);
			else if (child && typeof child === "object") visit(child);
		}
	};
	visit(scriptParser(APP_ROOT)(withoutTypes(code), false));
	return output;
}

/** The registrations the main thread's copy ends with, with the import that loads their runtime. */
export function registrationsOf(code: string): string {
	const start = code.indexOf("\nimport { loadWorkletRuntime");
	return start === -1 ? "" : code.slice(start);
}

/** The registrations alone, without the footer that loads the runtime for them: runnable with a stand-in for the registration function. */
export function registrationBodies(code: string): string {
	const opening = "if (__svelteLynxLoadWorkletRuntime()) {\n";
	const start = code.indexOf(opening);
	if (start === -1) return "";
	return code.slice(start + opening.length, code.lastIndexOf("}"));
}

/** Runs `body` as a function body with the given names in scope, and returns what it returns. */
export function evaluate(body: string, scope: Record<string, unknown> = {}): unknown {
	// oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval -- runs the build's own output
	return new Function(...Object.keys(scope), body)(...Object.values(scope));
}
