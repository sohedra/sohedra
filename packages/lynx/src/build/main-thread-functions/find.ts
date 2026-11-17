// Finds the main-thread functions of a script and what each captures.
//
// - Only the outermost such functions count: one inside another is part of the outer one's body.
// - A function captures the names it reads that the file declares outside it, imports included.
//   A name the file does not declare (also one it only declares with `declare`) is a global: the
//   main thread has its own. Of an object read member by member only those members are captured
//   (`settings.size.width`), up to a computed member, `.current` or a `?.` (`item?.title`
//   captures `item`: the body reads it with the `?.`). A method called on an object captures the
//   object, not the method (`hold.spring.set(2)` captures `hold.spring`): a method alone has lost
//   its object, and a function is dropped when the captures are sent across.
// - `runOnBackground(fn)` makes `fn` a background function: the object holds a handle to it, and
//   the body passes the handle on.

import type { BuildDetails } from "../diagnostics/catalogue.ts";
import { capture, memberSegment, narrowable } from "./captures.ts";
import type { Captures, Segment } from "./captures.ts";
import {
	patternNames,
	FUNCTIONS,
	TYPE_WRAPPERS,
	isMainThreadFunction,
	unwrap,
} from "./directive.ts";
import type { Node } from "./node.ts";

/** What declares a name where it stands, besides variables and imports. */
const NAMED_DECLARATIONS = new Set([
	"FunctionDeclaration",
	"ClassDeclaration",
	"TSEnumDeclaration",
	"TSModuleDeclaration",
	"TSImportEqualsDeclaration",
]);
/** Not nodes. */
const SKIPPED_KEYS = new Set(["loc", "leadingComments", "trailingComments"]);

/**
 * The binding's own functions that main-thread code calls. Each thread has its own, so they are
 * used where the body runs, never captured.
 */
const NEVER_CAPTURED = new Set(["runOnBackground", "runOnMainThread"]);
/** The methods of a function that call it: `save.call(…)` calls `save`. */
const CALL_METHODS = new Set(["call", "apply", "bind"]);

/** What a block or a function declares. */
interface Declared {
	names: Set<string>;
	/** The names set before the scope's first statement runs: parameters, imports, function declarations. */
	early: Set<string>;
	/** The main-thread function declarations, by name. */
	declarations: Map<string, Node>;
}

/** The names a block or a function declares. */
export interface Scope extends Declared {
	/** Where code runs before the scope's statements, if a declaration can go there. */
	top: number | undefined;
	/** How many plain functions are around it, outside main-thread functions. */
	depth: number;
	parent: Scope | undefined;
}

const declared = (): Declared => ({ names: new Set(), early: new Set(), declarations: new Map() });

/** Where code goes to run before `statements`: after their leading imports and directives. */
function topOf(statements: Node[], start: number): number {
	let top = start;
	for (const statement of statements) {
		if (statement.type !== "ImportDeclaration" && typeof statement.directive !== "string") break;
		top = statement.end;
	}
	return top;
}

/** A main-thread function of a script. */
export interface Found {
	node: Node;
	parent: Node;
	/** Its parameters and what its body declares. */
	scope: Scope;
	/**
	 * The names its body calls it by: its own name, and the name of the variable it is the value of
	 * (`const tick = () => { … tick … }`), unless the body declares them for itself.
	 */
	self: Set<string>;
	/** Which of those names the body uses. */
	callsItself: Set<string>;
	captures: Captures;
	/** The captured names the body calls, each with the first call's callee. */
	called: Map<string, Node>;
	/** The argument of each `runOnBackground(...)` in it, in source order. */
	handles: Node[];
	/** The scope a function declaration is declared in. */
	declaredIn: Scope | undefined;
	/** The scope each captured name is declared in. */
	capturedFrom: Map<string, Scope>;
}

/** The errors a script's walk can fail with. */
export type FailCode =
	| "main_thread_function_method"
	| "main_thread_function_this"
	| "main_thread_function_generator"
	| "main_thread_function_used_early";

/** A message of a function that cannot be a main-thread function. */
export type Failure = { [Code in FailCode]: { code: Code; details: BuildDetails[Code] } }[FailCode];

/** Reports the function `node` as one that cannot be a main-thread function. */
export type Fail = (node: Node, failure: Failure) => never;

/** What a script's walk found. */
export interface ScriptFunctions {
	found: Found[];
	/** The names a component's script declares with `$state`. */
	deepState: Set<string>;
	/** The functions declared at the top of a component's script. */
	topLevel: Set<Node>;
	/** The first use of a main-thread function declaration above it, in its own scope. */
	earlyUses: Map<Node, Node>;
}

/** Add the names of the program's imports marked `with { runtime: "shared" }` to `shared`. */
function sharedImports(program: Node, shared: Set<string>): void {
	for (const statement of program.body) {
		if (statement.type !== "ImportDeclaration") continue;
		const isShared = statement.attributes?.some(
			(attribute: Node) =>
				(attribute.key.name ?? attribute.key.value) === "runtime" &&
				attribute.value.value === "shared",
		);
		if (isShared) for (const specifier of statement.specifiers) shared.add(specifier.local.name);
	}
}

/**
 * Find the script's main-thread functions and what each captures. Also, for
 * an instance script: its `$state` names, and the functions declared at its
 * top level. `outer` is the program of a component's module script, around
 * its instance script.
 */
export function findFunctions(options: {
	program: Node;
	instance: boolean;
	fail: Fail;
	outer?: Node;
}): ScriptFunctions {
	const { program, instance, fail, outer } = options;
	const found: Found[] = [];
	/** Imports marked `with { runtime: "shared" }`: the main thread imports them too. */
	const shared = new Set<string>();
	const deepState = new Set<string>();
	const topLevel = new Set<Node>();
	const earlyUses = new Map<Node, Node>();
	sharedImports(program, shared);
	if (outer) sharedImports(outer, shared);
	for (const statement of program.body) {
		if (instance && statement.type === "FunctionDeclaration") {
			topLevel.add(statement);
		} else if (instance && statement.type === "VariableDeclaration") {
			for (const declarator of statement.declarations) {
				const init = unwrap(declarator.init);
				if (statement.kind !== "var" && init) topLevel.add(init);
				if (
					init?.type === "CallExpression" &&
					init.callee.type === "Identifier" &&
					init.callee.name === "$state"
				)
					patternNames(declarator.id, deepState);
			}
		}
	}

	let scope: Scope | undefined;
	/** How many plain functions are around, outside main-thread functions: code in them runs later. */
	let deferred = 0;
	/** The main-thread function being read. */
	let current: Found | undefined;
	/** Whether `this` here would be that function's. */
	let ownThis = false;
	// A member path being read: `depth` is how many members are still to come after the part being
	// visited, `path` what was read of it so far.
	let depth = 0;
	let path: Segment[] = [];
	// The callee of the call being read: a method on an object is not captured on its own.
	let callee: Node;
	// The captured name `fn.call(…)`, `fn.apply(…)` or `fn.bind(…)` calls: it is called, too.
	let calledThrough: Node;

	const within = (names: Set<string> | Declared, body: () => void, top?: number): void => {
		const outer = scope;
		const own = names instanceof Set ? { ...declared(), names } : names;
		scope = { ...own, top, depth: deferred, parent: outer };
		body();
		scope = outer;
	};

	/**
	 * Add the names `node` declares to `into`: a statement of the scope's own
	 * list (`own`) declares all of them there; with `deep`, the `var`s further
	 * inside it belong there too (the scope is a function's).
	 */
	const declare = (node: Node, into: Declared, own: boolean, deep: boolean): void => {
		const { names } = into;
		// `declare` says a name exists elsewhere: it declares nothing here.
		if (!node || typeof node.type !== "string" || node.declare) return;
		if (node.type === "ImportDeclaration") {
			if (node.importKind !== "type")
				for (const specifier of node.specifiers)
					if (specifier.importKind !== "type") {
						names.add(specifier.local.name);
						into.early.add(specifier.local.name);
					}
		} else if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
			declare(node.declaration, into, own, deep);
		} else if (node.type === "VariableDeclaration") {
			if (own || node.kind === "var")
				for (const declarator of node.declarations) patternNames(declarator.id, names);
		} else if (NAMED_DECLARATIONS.has(node.type)) {
			if (own && node.id?.type === "Identifier") {
				names.add(node.id.name);
				if (node.type === "FunctionDeclaration") {
					into.early.add(node.id.name);
					if (isMainThreadFunction(node)) into.declarations.set(node.id.name, node);
				}
			}
		} else if (
			deep &&
			!node.type.startsWith("TS") &&
			!FUNCTIONS.has(node.type) &&
			node.type !== "ClassExpression"
		) {
			// Its `var`s belong to the function around; a function or a class inside keeps its own.
			for (const key in node) {
				if (SKIPPED_KEYS.has(key)) continue;
				const child = node[key];
				if (Array.isArray(child)) for (const item of child) declare(item, into, false, true);
				else if (child && typeof child === "object") declare(child, into, false, true);
			}
		}
	};

	/** A use of a main-thread function declaration above it, which runs before it would be made. */
	const earlyUse = (name: string, node: Node): void => {
		let from = scope;
		while (from && !from.names.has(name)) from = from.parent;
		const declaration = from?.declarations.get(name);
		if (declaration === undefined || from!.depth !== deferred) return;
		if (node.start < declaration.start && !earlyUses.has(declaration))
			earlyUses.set(declaration, node);
	};

	/** A name read in a main-thread function: captured if the file declares it outside the function. */
	const reference = (name: string, node: Node): void => {
		earlyUse(name, node);
		if (!current || shared.has(name) || NEVER_CAPTURED.has(name)) return;
		// In a component, `$count` reads the store `count`.
		const declared =
			instance && name.length > 1 && name.startsWith("$") && !name.startsWith("$$")
				? name.slice(1)
				: name;
		let inside = true;
		for (let from = scope; from; from = from.parent) {
			if (from.names.has(name) || (!inside && from.names.has(declared))) {
				if (!inside) {
					if (!current.capturedFrom.has(name)) current.capturedFrom.set(name, from);
					path = [{ name, key: name, access: name }];
					if ((node === callee || node === calledThrough) && !current.called.has(name))
						current.called.set(name, node);
					if (depth === 0) flush();
				} else if (from === current.scope && current.self.has(name)) {
					current.callsItself.add(name);
				}
				return;
			}
			if (from === current.scope) inside = false;
		}
	};

	const flush = (): void => {
		capture(current!.captures, path);
		path = [];
	};

	/** A pattern that declares names: only its defaults and computed keys read anything. */
	const binding = (node: Node): void => {
		switch (node?.type) {
			case "ObjectPattern":
				for (const property of node.properties) {
					if (property.type === "RestElement") binding(property.argument);
					else {
						if (property.computed) visit(property.key, property);
						binding(property.value);
					}
				}
				break;
			case "ArrayPattern":
				for (const element of node.elements) binding(element);
				break;
			case "RestElement":
				binding(node.argument);
				break;
			case "AssignmentPattern":
				binding(node.left);
				visit(node.right, node);
				break;
			case "TSParameterProperty":
				binding(node.parameter);
				break;
		}
	};

	const visitFunction = (node: Node, parent: Node): void => {
		// A signature without a body (an overload).
		if (!node.body) return;
		const own = declared();
		const { names } = own;
		for (const param of node.params) patternNames(param, names);
		for (const name of names) own.early.add(name);
		const block = node.body.type === "BlockStatement";
		if (block) for (const statement of node.body.body) declare(statement, own, true, true);
		const outermost = !current && isMainThreadFunction(node);
		// Code in a plain function runs when it is called; a main-thread function's captures are
		// read when it is made.
		const plain = !current && !outermost;
		if (plain) deferred++;
		// Its own names, unless a parameter or the body has taken them. The variable's name counts
		// only for a main-thread function: capturing it would read the variable before it exists.
		const self = new Set<string>();
		if (node.id) self.add(node.id.name);
		if (
			outermost &&
			parent?.type === "VariableDeclarator" &&
			parent.init === node &&
			parent.id.type === "Identifier"
		)
			self.add(parent.id.name);
		for (const name of self) {
			if (names.has(name)) self.delete(name);
			else names.add(name);
		}

		const outerThis = ownThis;
		const declaration = node.type === "FunctionDeclaration" ? scope : undefined;
		const top = block ? topOf(node.body.body, node.body.start + 1) : undefined;
		within(
			own,
			() => {
				if (outermost) {
					const method =
						parent?.type === "MethodDefinition" ||
						(parent?.type === "Property" && (parent.method || parent.kind !== "init"));
					if (method)
						fail(parent, {
							code: "main_thread_function_method",
							details: { kind: parent.type === "Property" ? "object" : "class" },
						});
					if (node.generator) fail(node, { code: "main_thread_function_generator", details: {} });
					current = {
						node,
						parent,
						scope: scope!,
						self,
						callsItself: new Set(),
						captures: new Map(),
						called: new Map(),
						handles: [],
						declaredIn: declaration,
						capturedFrom: new Map(),
					};
					found.push(current);
					ownThis = true;
				} else if (node.type !== "ArrowFunctionExpression") {
					ownThis = false;
				}
				for (const param of node.params) binding(param);
				if (block) for (const statement of node.body.body) visit(statement, node.body);
				else visit(node.body, node);
			},
			top,
		);
		ownThis = outerThis;
		if (plain) deferred--;
		if (outermost) current = undefined;
	};

	const visit = (node: Node, parent?: Node): void => {
		if (!node || typeof node.type !== "string" || node.declare) return;
		switch (node.type) {
			case "Identifier":
				reference(node.name, node);
				return;
			case "ThisExpression":
			case "Super":
				if (current && ownThis)
					fail(node, {
						code: "main_thread_function_this",
						details: { keyword: node.type === "Super" ? "super" : "this" },
					});
				return;
			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ArrowFunctionExpression":
				visitFunction(node, parent);
				return;
			case "ClassDeclaration":
			case "ClassExpression": {
				for (const decorator of node.decorators ?? []) visit(decorator, node);
				const outerThis = ownThis;
				ownThis = false;
				within(new Set(node.id ? [node.id.name] : []), () => {
					for (const member of node.body.body) visit(member, node.body);
				});
				ownThis = outerThis;
				visit(node.superClass, node);
				return;
			}
			case "Program":
			case "BlockStatement":
			case "StaticBlock":
			case "TSModuleBlock": {
				const own = declared();
				const deep = node.type !== "BlockStatement";
				for (const statement of node.body) declare(statement, own, true, deep);
				const top =
					node.type === "Program"
						? topOf(node.body, node.start)
						: node.type === "BlockStatement"
							? node.start + 1
							: undefined;
				within(
					own,
					() => {
						for (const statement of node.body) visit(statement, node);
					},
					top,
				);
				return;
			}
			case "ForStatement":
			case "ForInStatement":
			case "ForOfStatement": {
				const own = declared();
				declare(node.init ?? node.left, own, true, false);
				within(own, () => visitChildren(node));
				return;
			}
			case "SwitchStatement": {
				visit(node.discriminant, node);
				const own = declared();
				for (const switchCase of node.cases)
					for (const statement of switchCase.consequent) declare(statement, own, true, false);
				within(own, () => {
					for (const switchCase of node.cases) {
						visit(switchCase.test, switchCase);
						for (const statement of switchCase.consequent) visit(statement, switchCase);
					}
				});
				return;
			}
			case "DoWhileStatement":
				// The order ReactLynx's transform reads them in, for the same order of captures.
				visit(node.test, node);
				visit(node.body, node);
				return;
			case "TSEnumDeclaration":
				// A member's value may read the members before it.
				within(
					new Set(node.members.map((member: Node) => member.id.name ?? member.id.value)),
					() => {
						for (const member of node.members) visit(member.initializer, member);
					},
				);
				return;
			case "CatchClause":
				within(patternNames(node.param), () => {
					binding(node.param);
					visit(node.body, node);
				});
				return;
			case "VariableDeclarator":
				binding(node.id);
				visit(node.init, node);
				return;
			case "MemberExpression": {
				const object = unwrap(node.object);
				const segment = memberSegment(node);
				// A member read through `?.` is not captured: reading it when the
				// function is made would throw where the written code would not. The
				// object before the `?.` is captured, and the body keeps the `?.`.
				const stops =
					segment === undefined ||
					node.optional === true ||
					(segment.name === "current" && !node.computed) ||
					node === callee;
				if (!stops && narrowable(object)) {
					depth++;
					visit(object, node);
					depth = Math.max(depth, 1) - 1;
				} else {
					depth = 0;
					visit(object, node);
				}
				if (segment === undefined) {
					if (node.computed) visit(node.property, node);
				} else if (path.length > 0) {
					path.push(segment);
					if (depth === 0) flush();
				}
				return;
			}
			case "CallExpression":
				if (
					current &&
					node.callee.type === "Identifier" &&
					node.callee.name === "runOnBackground" &&
					node.arguments.length > 0
				) {
					// The argument is the background's: nothing in it is captured.
					current.handles.push(node.arguments[0]);
					return;
				}
				callee = unwrap(node.callee);
				calledThrough = undefined;
				if (
					callee.type === "MemberExpression" &&
					!callee.computed &&
					callee.property.type === "Identifier" &&
					CALL_METHODS.has(callee.property.name) &&
					unwrap(callee.object).type === "Identifier"
				)
					calledThrough = unwrap(callee.object);
				break;
			case "Property":
			case "MethodDefinition":
			case "PropertyDefinition":
			case "AccessorProperty":
				// A key that is not computed is a name, not a value read.
				visitChildren(node, node.computed ? undefined : "key");
				return;
			case "LabeledStatement":
				visit(node.body, node);
				return;
			case "ExportNamedDeclaration":
				visit(node.declaration, node);
				return;
			case "TSModuleDeclaration":
				visit(node.body, node);
				return;
			case "BreakStatement":
			case "ContinueStatement":
			case "MetaProperty":
			case "ImportDeclaration":
			case "ExportAllDeclaration":
				return;
		}
		if (TYPE_WRAPPERS.has(node.type)) visit(node.expression, node);
		// Any other TypeScript node is a type, or declares one.
		else if (!node.type.startsWith("TS")) visitChildren(node);
	};

	const visitChildren = (node: Node, except?: string): void => {
		for (const key in node) {
			if (key === except || SKIPPED_KEYS.has(key)) continue;
			const child = node[key];
			if (Array.isArray(child)) for (const item of child) visit(item, node);
			else if (child && typeof child === "object") visit(child, node);
		}
	};

	if (outer) {
		// The module script's names are outside every function of the instance script, and set
		// before it runs.
		const own = declared();
		for (const statement of outer.body) declare(statement, own, true, true);
		scope = { ...own, early: own.names, top: undefined, depth: 0, parent: undefined };
	}
	visit(program);
	return { found, deepState, topLevel, earlyUses };
}
