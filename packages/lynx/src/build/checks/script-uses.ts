// The globals a script reads, with the threads the build can tell each read runs on, for the checks
// of code that type-checks and then fails on Lynx:
//
// - outside every function (a module's top level, a component's script and markup), both: the main
//   thread runs it too, for the first frame;
// - inside a main-thread function, the main thread, except inside the function it hands
//   `runOnBackground`, which is the background's;
// - inside any other function, the background;
// - under a thread's flag (`if (mainThread)`, `if (!background) return;`), that thread only.
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
import {
	threadFunctionNames,
	threadFunctionOf,
} from "../main-thread-functions/thread-functions.ts";
import type { ThreadFunctionNames } from "../main-thread-functions/thread-functions.ts";
import {
	collect,
	FUNCTIONS,
	GLOBAL_OBJECTS,
	globalMemberName,
	memberOfGlobal,
	SKIPPED_KEYS,
} from "./script-names.ts";
import type { Declared } from "./script-names.ts";
import { flagNames, flagOf } from "./thread-flags.ts";
import type { FlagNames } from "./thread-flags.ts";

/** A function's names, or the program's. */
interface Scope {
	names: Map<string, Declared>;
	parent: Scope | undefined;
	/** Whether the scope is a main-thread function or inside one (and not in `runOnBackground`'s argument). */
	mainThread: boolean;
}

/** Where code runs, as far as the build can tell. */
interface At {
	/** The threads it runs on; none for a branch neither thread takes. */
	threads: readonly Thread[];
	/** Under a test that reads a thread's flag in a way the build can't resolve. */
	flagged: boolean;
}

/** A read of a global. */
export interface GlobalRead {
	/** The global's name; for a member of `lynx`, `lynx.<member>`. */
	name: string;
	/** Where the read starts in the text the program's positions point into. */
	start: number;
	/** The threads it runs on. */
	threads: readonly Thread[];
	/** Under a test that reads a thread's flag in a way the build can't resolve. */
	flagged: boolean;
	/** Whether it is outside every function, where the first frame runs it too. */
	topLevel: boolean;
	/** In markup: where the element whose attribute holds the read starts. */
	anchor?: number | undefined;
}

/** What a script reads, and how it guards it. */
interface ScriptUses {
	globals: GlobalRead[];
	/** The calls a main-thread function makes of a plain function the script declares outside it. */
	plainCalls: { name: string; start: number; anchor?: number | undefined }[];
	/**
	 * The globals the script checks for before it reads them: `typeof X`, `"X" in …`,
	 * `globalThis.X`, or a read inside a `try` that has a `catch`. A check anywhere in the file keeps
	 * every read of that name quiet.
	 */
	checked: Set<string>;
	/**
	 * The globals the script puts on the global object itself: `globalThis.X = …` (or `self.X`,
	 * `window.X`), `Object.defineProperty(globalThis, "X", …)`.
	 */
	installs: Set<string>;
	/** The modules the script imports, as written. */
	imports: Set<string>;
}

/** The build's constants that tell the threads apart, read as free names, with their thread. */
const THREAD_CONSTANTS: Readonly<Record<string, Thread>> = {
	__MAIN_THREAD__: "main-thread",
	__LEPUS__: "main-thread",
	__BACKGROUND__: "background",
	__JS__: "background",
};

const BOTH: readonly Thread[] = ["background", "main-thread"];

/** The other thread. */
const other = (thread: Thread): Thread => (thread === "background" ? "main-thread" : "background");

/** The threads of `at` that `thread` is one of. */
const only = (at: At, thread: Thread): At => ({
	threads: at.threads.filter((each) => each === thread),
	flagged: at.flagged,
});

/** Whether a statement ends its function: a `return` or a `throw`, alone or last in a block. */
function exits(statement: Node): boolean {
	if (statement?.type === "ReturnStatement" || statement?.type === "ThrowStatement") return true;
	return statement?.type === "BlockStatement" && exits(statement.body[statement.body.length - 1]);
}

/** The walk of one file's scripts. */
class Walk {
	readonly uses: ScriptUses = {
		globals: [],
		plainCalls: [],
		checked: new Set(),
		installs: new Set(),
		imports: new Set(),
	};
	readonly flags: FlagNames;
	readonly threadFunctions: ThreadFunctionNames;
	/** The markup element whose attribute is being read, if any. */
	anchor: number | undefined;
	/** How many functions the walk is inside. */
	depth = 0;

	constructor(flags: FlagNames, threadFunctions: ThreadFunctionNames) {
		this.flags = flags;
		this.threadFunctions = threadFunctions;
	}

	/** The scope a name is declared in, from `scope` out. */
	declaring(name: string, scope: Scope | undefined): Scope | undefined {
		for (let current = scope; current; current = current.parent)
			if (current.names.has(name)) return current;
		return undefined;
	}

	/** Whether `name`, read in `scope`, is declared at the top level, where the imports are. */
	atTop(name: string, scope: Scope): boolean {
		const declaring = this.declaring(name, scope);
		return declaring !== undefined && declaring.parent === undefined;
	}

	/** The thread a flag, a constant or its negation is true on, if `test` is one. */
	flagTest(test: Node, scope: Scope): Thread | undefined {
		const negated = test?.type === "UnaryExpression" && test.operator === "!";
		const node = negated ? test.argument : test;
		let thread: Thread | undefined;
		if (node?.type === "Identifier" && !this.declaring(node.name, scope))
			thread = THREAD_CONSTANTS[node.name];
		thread ??= node ? flagOf(node, this.flags) : undefined;
		if (thread === undefined) return undefined;
		return negated ? other(thread) : thread;
	}

	/** Whether `test` reads a thread's flag anywhere. */
	readsFlag(test: Node): boolean {
		return [...nodes(test)].some(
			(node) =>
				(node.type === "Identifier" &&
					Object.prototype.hasOwnProperty.call(THREAD_CONSTANTS, String(node.name))) ||
				flagOf(node, this.flags) !== undefined,
		);
	}

	/** A global read, at `node`. */
	push(name: string, node: Node, at: At): void {
		this.uses.globals.push({
			name,
			start: node.start,
			threads: at.threads,
			flagged: at.flagged,
			topLevel: this.depth === 0,
			anchor: this.anchor,
		});
	}

	/** A name read as a value. */
	read(node: Node, scope: Scope, at: At): void {
		if (!this.declaring(node.name, scope)) this.push(node.name, node, at);
	}

	/** A pattern that declares names: only its defaults and computed keys are read. */
	pattern(node: Node, scope: Scope, at: At): void {
		switch (node?.type) {
			case "AssignmentPattern":
				this.pattern(node.left, scope, at);
				this.visit(node.right, scope, at);
				break;
			case "ObjectPattern":
				for (const property of node.properties) {
					if (property.type === "RestElement") this.pattern(property.argument, scope, at);
					else {
						if (property.computed) this.visit(property.key, scope, at);
						this.pattern(property.value, scope, at);
					}
				}
				break;
			case "ArrayPattern":
				for (const element of node.elements) this.pattern(element, scope, at);
				break;
			case "RestElement":
				this.pattern(node.argument, scope, at);
				break;
			case "TSParameterProperty":
				this.pattern(node.parameter, scope, at);
				break;
		}
	}

	/** A function: a scope of its own, with its parameters and what its body declares. */
	function(node: Node, scope: Scope, at: At, background = false): void {
		const names = new Map<string, Declared>();
		if (node.type === "FunctionExpression" && node.id) names.set(node.id.name, "value");
		for (const parameter of node.params ?? [])
			for (const name of patternNames(parameter)) names.set(name, "value");
		collect(node.body, names);
		const mainThread = !background && (scope.mainThread || isMainThreadFunction(node));
		const inner: Scope = { names, parent: scope, mainThread };
		let threads: readonly Thread[];
		if (background) threads = ["background"];
		else if (isMainThreadFunction(node)) threads = ["main-thread"];
		// A function at the top level runs where it is called: the background, but for the few the
		// first frame calls, which the build can't tell.
		else threads = at.threads.length > 1 ? ["background"] : at.threads;
		const inside: At = { threads, flagged: at.flagged };
		this.depth++;
		for (const parameter of node.params ?? []) this.pattern(parameter, inner, inside);
		if (node.body?.type === "BlockStatement") this.statements(node.body.body, inner, inside);
		else this.visit(node.body, inner, inside);
		this.depth--;
	}

	/** Statements in order: after a guard on a thread's flag that returns or throws, one thread runs. */
	statements(list: Node[], scope: Scope, at: At): void {
		let now = at;
		for (const statement of list) {
			this.visit(statement, scope, now);
			if (statement?.type !== "IfStatement" || !exits(statement.consequent)) continue;
			const thread = this.flagTest(statement.test, scope);
			if (thread !== undefined) now = only(now, other(thread));
			else if (this.readsFlag(statement.test)) now = { ...now, flagged: true };
		}
	}

	/** A test, and the code it decides: a thread's flag narrows each branch to its thread. */
	branch(test: Node, consequent: Node, alternate: Node, scope: Scope, at: At): void {
		this.visit(test, scope, at);
		const thread = this.flagTest(test, scope);
		if (thread !== undefined) {
			this.visit(consequent, scope, only(at, thread));
			this.visit(alternate, scope, only(at, other(thread)));
			return;
		}
		const joined =
			test?.type === "LogicalExpression" && test.operator === "&&"
				? (this.flagTest(test.left, scope) ?? this.flagTest(test.right, scope))
				: undefined;
		const decided: At = this.readsFlag(test) ? { ...at, flagged: true } : at;
		this.visit(consequent, scope, joined === undefined ? decided : only(at, joined));
		this.visit(alternate, scope, decided);
	}

	/** A feature check of `name`. */
	check(name: string): void {
		this.uses.checked.add(name);
	}

	visit(node: Node, scope: Scope, at: At): void {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const item of node) this.visit(item, scope, at);
			return;
		}
		const type: string = node.type ?? "";
		if (FUNCTIONS.has(type)) {
			this.function(node, scope, at);
			return;
		}
		if (TYPE_WRAPPERS.has(type)) {
			this.visit(node.expression, scope, at);
			return;
		}
		if (type.startsWith("TS") && type !== "TSExportAssignment") return;
		switch (type) {
			case "Identifier":
				this.read(node, scope, at);
				return;
			case "BlockStatement":
				this.statements(node.body, scope, at);
				return;
			case "ImportDeclaration":
				if (typeof node.source?.value === "string") this.uses.imports.add(node.source.value);
				return;
			case "ImportExpression":
				if (typeof node.source?.value === "string") this.uses.imports.add(node.source.value);
				this.visit(node.source, scope, at);
				return;
			case "ExportNamedDeclaration":
				this.visit(node.declaration, scope, at);
				return;
			case "LabeledStatement":
				this.visit(node.body, scope, at);
				return;
			case "ExportAllDeclaration":
			case "BreakStatement":
			case "ContinueStatement":
			case "MetaProperty":
				return;
			case "VariableDeclarator":
				this.pattern(node.id, scope, at);
				this.visit(node.init, scope, at);
				return;
			case "ClassDeclaration":
			case "ClassExpression":
				this.visit(node.superClass, scope, at);
				this.visit(node.decorators, scope, at);
				this.visit(node.body, scope, at);
				return;
			case "MethodDefinition":
			case "PropertyDefinition":
			case "AccessorProperty":
			case "Property":
				if (node.computed) this.visit(node.key, scope, at);
				this.visit(node.decorators, scope, at);
				this.visit(node.value, scope, at);
				return;
			case "CatchClause":
				this.pattern(node.param, scope, at);
				this.visit(node.body, scope, at);
				return;
			case "TryStatement":
				if (node.handler) {
					// What the block reads, the `catch` handles: a feature check of each.
					const before = this.uses.globals.length;
					this.visit(node.block, scope, at);
					for (const read of this.uses.globals.splice(before)) this.check(read.name);
				} else this.visit(node.block, scope, at);
				this.visit(node.handler, scope, at);
				this.visit(node.finalizer, scope, at);
				return;
			case "AssignmentExpression":
				this.install(node.left, scope);
				if (node.left?.type === "Identifier") this.read(node.left, scope, at);
				else if (node.left?.type?.endsWith("Pattern")) this.pattern(node.left, scope, at);
				else this.visit(node.left, scope, at);
				this.visit(node.right, scope, at);
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
					if (member.startsWith("lynx.")) this.push(member, node, at);
					else this.check(member);
				}
				this.visit(node.object, scope, at);
				if (node.computed) this.visit(node.property, scope, at);
				return;
			}
			case "CallExpression":
				// As the main-thread functions' compile reads it (main-thread-functions/thread-functions.ts):
				// the argument of `runOnBackground(…)` in a main-thread function runs on the background.
				if (
					scope.mainThread &&
					threadFunctionOf(node.callee, this.threadFunctions, (name) => this.atTop(name, scope)) ===
						"runOnBackground" &&
					node.arguments.length > 0
				) {
					this.visit(node.callee, scope, at);
					const handed = node.arguments[0];
					if (FUNCTIONS.has(handed?.type)) this.function(handed, scope, at, true);
					else this.visit(handed, scope, at);
					this.visit(node.arguments.slice(1), scope, at);
					return;
				}
				this.defineProperty(node, scope);
				this.plainCall(node, scope);
				break;
			case "IfStatement":
			case "ConditionalExpression":
				this.branch(node.test, node.consequent, node.alternate, scope, at);
				return;
			case "LogicalExpression":
				if (node.operator === "&&") this.branch(node.left, node.right, undefined, scope, at);
				else {
					this.visit(node.left, scope, at);
					this.visit(node.right, scope, this.readsFlag(node.left) ? { ...at, flagged: true } : at);
				}
				return;
		}
		for (const key of Object.keys(node))
			if (!SKIPPED_KEYS.has(key)) this.visit(node[key], scope, at);
	}

	/** In a main-thread function, a call of a plain function the script declares outside it. */
	plainCall(node: Node, scope: Scope): void {
		if (!scope.mainThread) return;
		let callee = node.callee;
		while (callee && TYPE_WRAPPERS.has(callee.type)) callee = callee.expression;
		if (callee?.type !== "Identifier") return;
		const declaring = this.declaring(callee.name, scope);
		if (declaring && !declaring.mainThread && declaring.names.get(callee.name) === "plain-function")
			this.uses.plainCalls.push({ name: callee.name, start: callee.start, anchor: this.anchor });
	}

	/** An assignment to `globalThis.X` (or `self.X`, `window.X`): the script installs `X`. */
	install(target: Node, scope: Scope): void {
		const name = globalMemberName(target);
		if (name !== undefined && !this.declaring(target.object.name, scope))
			this.uses.installs.add(name);
	}

	/** `Object.defineProperty(globalThis, "X", …)`: the script installs `X`. */
	defineProperty(node: Node, scope: Scope): void {
		const callee = node.callee;
		if (
			callee?.type !== "MemberExpression" ||
			callee.object?.type !== "Identifier" ||
			callee.object.name !== "Object" ||
			callee.property?.name !== "defineProperty"
		)
			return;
		const [target, key] = node.arguments;
		if (
			target?.type === "Identifier" &&
			GLOBAL_OBJECTS.has(target.name) &&
			!this.declaring(target.name, scope) &&
			typeof key?.value === "string"
		)
			this.uses.installs.add(key.value);
	}
}

/** One of a component markup's expressions. */
export interface MarkupExpression {
	node: Node;
	/** The thread of the branch it is in (`{#if background}`); both threads when it is in none. */
	thread?: Thread | undefined;
	/** Where the element starts whose attribute holds it. */
	anchor?: number | undefined;
}

/** The code of a file: its programs, the names its markup declares, and its markup's expressions. */
export interface ScriptRoots {
	/** The programs, whose top-level names every root sees. */
	programs: Node[];
	/** The names the markup declares (blocks' items, snippets, `{@const}`), which every root sees. */
	declared?: Iterable<string>;
	/** The markup's expressions. */
	expressions?: MarkupExpression[];
}

/** What a file's scripts read. */
export function scriptUses({ programs, declared = [], expressions = [] }: ScriptRoots): ScriptUses {
	const names = new Map<string, Declared>();
	for (const program of programs) collect(program.body, names);
	for (const name of declared) if (!names.has(name)) names.set(name, "value");
	const top: Scope = { names, parent: undefined, mainThread: false };
	const walk = new Walk(flagNames(programs), threadFunctionNames(programs));
	const everywhere: At = { threads: BOTH, flagged: false };
	for (const program of programs) walk.statements(program.body, top, everywhere);
	for (const { node, thread, anchor } of expressions) {
		walk.anchor = anchor;
		walk.visit(node, top, thread === undefined ? everywhere : only(everywhere, thread));
	}
	return walk.uses;
}
