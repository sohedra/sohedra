// The globals a script reads, with the thread the build can tell each read runs on, for the checks
// of code that type-checks and then fails on Lynx. A read inside a main-thread function runs on the
// main thread; every other read is taken as the background's.
//
// The scopes are coarse on purpose, so a check never reports a name the script declares: a function
// (or the program) declares every name declared anywhere in it outside a nested function, and a
// component's markup sees every name its scripts and blocks declare.

import { nodes } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import {
	isMainThreadFunction,
	patternNames,
	TYPE_WRAPPERS,
} from "../main-thread-functions/directive.ts";
import type { Node } from "../main-thread-functions/node.ts";

/** What a declared name is, for a call from a main-thread function. */
type Declared = "plain-function" | "value";

/** A function's names, or the program's. */
interface Scope {
	names: Map<string, Declared>;
	parent: Scope | undefined;
	/** Whether the scope is a main-thread function or inside one. */
	mainThread: boolean;
}

/** A read of a global. */
export interface GlobalRead {
	/** The global's name; for a member of `lynx`, `lynx.<member>`. */
	name: string;
	/** Where the read starts in the text the program's positions point into. */
	start: number;
	thread: Thread;
	/** Inside a test that reads a thread flag (`__MAIN_THREAD__`, `BROWSER`, `background`…). */
	flagged: boolean;
}

/** What a script reads, and how it guards it. */
export interface ScriptUses {
	globals: GlobalRead[];
	/** The calls a main-thread function makes of a plain function the script declares outside it. */
	plainCalls: { name: string; start: number }[];
	/**
	 * The globals the script checks for before it reads them: `typeof X`, `"X" in …`,
	 * `globalThis.X`. A check anywhere in the file keeps every read of that name quiet.
	 */
	checked: Set<string>;
	/** The modules the script imports, as written. */
	imports: Set<string>;
}

/** The names of the flags a thread branch reads. */
const THREAD_FLAGS = new Set([
	"__MAIN_THREAD__",
	"__BACKGROUND__",
	"__LEPUS__",
	"__JS__",
	"BROWSER",
	"background",
	"mainThread",
]);

/** The objects a global is read from as a member, which a check reads as a feature check. */
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self", "global"]);

/** Keys that hold types, comments or positions, not code. */
const SKIPPED_KEYS = new Set([
	"loc",
	"leadingComments",
	"trailingComments",
	"typeAnnotation",
	"returnType",
	"typeParameters",
	"typeArguments",
	"superTypeParameters",
	"superTypeArguments",
	"implements",
	"metadata",
	"parent",
]);

const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/** What a declaration with this value declares, for a call from a main-thread function. */
function declaredAs(value: Node): Declared {
	let init = value;
	while (init && TYPE_WRAPPERS.has(init.type)) init = init.expression;
	return FUNCTIONS.has(init?.type) && !isMainThreadFunction(init) ? "plain-function" : "value";
}

/**
 * Adds to `names` every name declared in `node`, outside nested functions: variables, functions,
 * classes, imports, enums, a `catch`'s parameter.
 */
function collect(node: Node, names: Map<string, Declared>): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) collect(item, names);
		return;
	}
	switch (node.type) {
		case "VariableDeclarator":
			for (const name of patternNames(node.id)) names.set(name, "value");
			if (node.id?.type === "Identifier" && node.init)
				names.set(node.id.name, declaredAs(node.init));
			break;
		case "FunctionDeclaration":
			if (node.id) names.set(node.id.name, declaredAs(node));
			return;
		case "FunctionExpression":
		case "ArrowFunctionExpression":
			return;
		case "ClassDeclaration":
		case "TSEnumDeclaration":
		case "TSModuleDeclaration":
		case "TSImportEqualsDeclaration":
			if (node.id?.type === "Identifier") names.set(node.id.name, "value");
			break;
		case "ImportSpecifier":
		case "ImportDefaultSpecifier":
		case "ImportNamespaceSpecifier":
			names.set(node.local.name, "value");
			return;
		case "CatchClause":
			for (const name of patternNames(node.param)) names.set(name, "value");
			break;
	}
	for (const key of Object.keys(node)) if (!SKIPPED_KEYS.has(key)) collect(node[key], names);
}

/** Whether `test` reads a thread flag anywhere. */
const readsFlag = (test: Node): boolean =>
	[...nodes(test)].some(
		(node) => node.type === "Identifier" && THREAD_FLAGS.has(String(node.name)),
	);

/** The walk of one file's scripts. */
class Walk {
	readonly uses: ScriptUses = {
		globals: [],
		plainCalls: [],
		checked: new Set(),
		imports: new Set(),
	};

	/** The scope a name is declared in, from `scope` out. */
	declaring(name: string, scope: Scope | undefined): Scope | undefined {
		for (let current = scope; current; current = current.parent)
			if (current.names.has(name)) return current;
		return undefined;
	}

	/** A name read as a value. */
	read(node: Node, scope: Scope, flagged: boolean): void {
		if (this.declaring(node.name, scope)) return;
		this.uses.globals.push({
			name: node.name,
			start: node.start,
			thread: scope.mainThread ? "main-thread" : "background",
			flagged,
		});
	}

	/** A pattern that declares names: only its defaults and computed keys are read. */
	pattern(node: Node, scope: Scope, flagged: boolean): void {
		switch (node?.type) {
			case "AssignmentPattern":
				this.pattern(node.left, scope, flagged);
				this.visit(node.right, scope, flagged);
				break;
			case "ObjectPattern":
				for (const property of node.properties) {
					if (property.type === "RestElement") this.pattern(property.argument, scope, flagged);
					else {
						if (property.computed) this.visit(property.key, scope, flagged);
						this.pattern(property.value, scope, flagged);
					}
				}
				break;
			case "ArrayPattern":
				for (const element of node.elements) this.pattern(element, scope, flagged);
				break;
			case "RestElement":
				this.pattern(node.argument, scope, flagged);
				break;
			case "TSParameterProperty":
				this.pattern(node.parameter, scope, flagged);
				break;
		}
	}

	/** A function: a scope of its own, with its parameters and what its body declares. */
	function(node: Node, scope: Scope, flagged: boolean): void {
		const names = new Map<string, Declared>();
		if (node.type === "FunctionExpression" && node.id) names.set(node.id.name, "value");
		for (const parameter of node.params ?? [])
			for (const name of patternNames(parameter)) names.set(name, "value");
		collect(node.body, names);
		const inner: Scope = {
			names,
			parent: scope,
			mainThread: scope.mainThread || isMainThreadFunction(node),
		};
		for (const parameter of node.params ?? []) this.pattern(parameter, inner, flagged);
		this.visit(node.body, inner, flagged);
	}

	/** A test that may read a thread flag, and what it decides. */
	branch(test: Node, decided: Node[], scope: Scope, flagged: boolean): void {
		this.visit(test, scope, flagged);
		const inner = flagged || readsFlag(test);
		for (const node of decided) this.visit(node, scope, inner);
	}

	/** A feature check of `name`. */
	check(name: string): void {
		this.uses.checked.add(name);
	}

	visit(node: Node, scope: Scope, flagged: boolean): void {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const item of node) this.visit(item, scope, flagged);
			return;
		}
		const type: string = node.type ?? "";
		if (FUNCTIONS.has(type)) {
			this.function(node, scope, flagged);
			return;
		}
		if (TYPE_WRAPPERS.has(type)) {
			this.visit(node.expression, scope, flagged);
			return;
		}
		if (type.startsWith("TS") && type !== "TSExportAssignment") return;
		switch (type) {
			case "Identifier":
				this.read(node, scope, flagged);
				return;
			case "ImportDeclaration":
				if (typeof node.source?.value === "string") this.uses.imports.add(node.source.value);
				return;
			case "ImportExpression":
				if (typeof node.source?.value === "string") this.uses.imports.add(node.source.value);
				this.visit(node.source, scope, flagged);
				return;
			case "ExportNamedDeclaration":
				this.visit(node.declaration, scope, flagged);
				return;
			case "LabeledStatement":
				this.visit(node.body, scope, flagged);
				return;
			case "ExportAllDeclaration":
			case "BreakStatement":
			case "ContinueStatement":
			case "MetaProperty":
				return;
			case "VariableDeclarator":
				this.pattern(node.id, scope, flagged);
				this.visit(node.init, scope, flagged);
				return;
			case "ClassDeclaration":
			case "ClassExpression":
				this.visit(node.superClass, scope, flagged);
				this.visit(node.decorators, scope, flagged);
				this.visit(node.body, scope, flagged);
				return;
			case "MethodDefinition":
			case "PropertyDefinition":
			case "AccessorProperty":
			case "Property":
				if (node.computed) this.visit(node.key, scope, flagged);
				this.visit(node.decorators, scope, flagged);
				this.visit(node.value, scope, flagged);
				return;
			case "CatchClause":
				this.pattern(node.param, scope, flagged);
				this.visit(node.body, scope, flagged);
				return;
			case "AssignmentExpression":
				if (node.left?.type === "Identifier") this.read(node.left, scope, flagged);
				else if (node.left?.type?.endsWith("Pattern")) this.pattern(node.left, scope, flagged);
				else this.visit(node.left, scope, flagged);
				this.visit(node.right, scope, flagged);
				return;
			case "UnaryExpression":
				if (node.operator === "typeof") {
					const argument = node.argument;
					if (argument?.type === "Identifier") {
						this.check(argument.name);
						return;
					}
					const member = memberOfGlobal(argument);
					if (member !== undefined) this.check(member);
				}
				break;
			case "BinaryExpression":
				if (node.operator === "in" && typeof node.left?.value === "string") {
					const object = node.right?.type === "Identifier" ? node.right.name : undefined;
					this.check(object === "lynx" ? `lynx.${node.left.value}` : node.left.value);
				}
				break;
			case "MemberExpression": {
				const member = memberOfGlobal(node);
				if (member !== undefined && !this.declaring(node.object.name, scope)) {
					if (member.startsWith("lynx."))
						this.uses.globals.push({
							name: member,
							start: node.start,
							thread: scope.mainThread ? "main-thread" : "background",
							flagged,
						});
					else this.check(member);
				}
				this.visit(node.object, scope, flagged);
				if (node.computed) this.visit(node.property, scope, flagged);
				return;
			}
			case "CallExpression":
				this.plainCall(node, scope);
				break;
			case "IfStatement":
			case "ConditionalExpression":
				this.branch(node.test, [node.consequent, node.alternate], scope, flagged);
				return;
			case "LogicalExpression":
				this.branch(node.left, [node.right], scope, flagged);
				return;
		}
		for (const key of Object.keys(node))
			if (!SKIPPED_KEYS.has(key)) this.visit(node[key], scope, flagged);
	}

	/** In a main-thread function, a call of a plain function the script declares outside it. */
	plainCall(node: Node, scope: Scope): void {
		if (!scope.mainThread) return;
		let callee = node.callee;
		while (callee && TYPE_WRAPPERS.has(callee.type)) callee = callee.expression;
		if (callee?.type !== "Identifier") return;
		const declaring = this.declaring(callee.name, scope);
		if (declaring && !declaring.mainThread && declaring.names.get(callee.name) === "plain-function")
			this.uses.plainCalls.push({ name: callee.name, start: callee.start });
	}
}

/**
 * The global `X` a member read `globalThis.X` (or `window.X`, `self.X`) names, or `lynx.X` for a
 * member of `lynx`; `undefined` for any other node.
 */
function memberOfGlobal(node: Node): string | undefined {
	if (node?.type !== "MemberExpression" || node.computed) return undefined;
	if (node.object?.type !== "Identifier" || node.property?.type !== "Identifier") return undefined;
	if (node.object.name === "lynx") return `lynx.${node.property.name}`;
	return GLOBAL_OBJECTS.has(node.object.name) ? node.property.name : undefined;
}

/** The code of a file: its programs, the names its markup declares, and its markup's expressions. */
export interface ScriptRoots {
	/** The programs, whose top-level names every root sees. */
	programs: Node[];
	/** The names the markup declares (blocks' items, snippets, `{@const}`), which every root sees. */
	declared?: Iterable<string>;
	/** The markup's expressions. */
	expressions?: Node[];
}

/** What a file's scripts read. */
export function scriptUses({ programs, declared = [], expressions = [] }: ScriptRoots): ScriptUses {
	const names = new Map<string, Declared>();
	for (const program of programs) collect(program.body, names);
	for (const name of declared) if (!names.has(name)) names.set(name, "value");
	const top: Scope = { names, parent: undefined, mainThread: false };
	const walk = new Walk();
	for (const program of programs) walk.visit(program.body, top, false);
	for (const expression of expressions) walk.visit(expression, top, false);
	return walk.uses;
}
