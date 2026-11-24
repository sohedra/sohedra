// Writes the types an app gets for what each import fills: `types/generated/<import>.d.ts`
// declares, in `declare global`, the globals that import installs on either thread, and `web.d.ts` the
// interfaces and types they name. Both come from TypeScript's own `lib.webworker.d.ts` (the web's
// APIs without the DOM), cut to what the package fills: a type the fills never name stays out, and
// so does a global no import installs, so `URL` is a type error until an import of the package
// that fills it. Which globals each import installs is the entries' snapshot
// (tests/package/entries.test.ts), as each thread's realm shows them.
//
// The output is committed; a test writes it again and compares, so a TypeScript update that
// changes its web types fails until this runs: `pnpm -F @sohedra/lynx-polyfill generate`.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { format } from "oxfmt";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The command that writes the types. */
export const GENERATE_COMMAND = "pnpm -F @sohedra/lynx-polyfill generate";

const SNAPSHOT = path.join(ROOT, "tests/package/__snapshots__/entries.test.ts.snap");

/** The files of TypeScript's web types without the DOM, read in this order. */
const LIBS = [
	"lib.webworker.d.ts",
	"lib.webworker.iterable.d.ts",
	"lib.webworker.asynciterable.d.ts",
];

/** The file of the interfaces and types every import's globals name. */
export const WEB_TYPES = "types/generated/web.d.ts";

/**
 * The file of an import's types: `index.d.ts` for the package itself, `url.d.ts` for `/url`.
 */
export const typesFile = (subpath: string): string =>
	`types/generated/${subpath === "" ? "index" : subpath.slice(1)}.d.ts`;

/**
 * Globals that a worker's types declare for a worker's global scope, written here for a Lynx
 * thread's: the global object as an `EventTarget` and `navigator` with what the fill gives.
 */
const OWN_GLOBALS: Readonly<Record<string, string>> = {
	self: "var self: typeof globalThis;",
	navigator: "var navigator: Navigator;",
	addEventListener:
		"function addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;",
	removeEventListener:
		"function removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;",
	dispatchEvent: "function dispatchEvent(event: Event): boolean;",
	onerror: "var onerror: ((this: typeof globalThis, event: ErrorEvent) => unknown) | null;",
};

/**
 * Types written here in place of the worker's, which name what Lynx has none of (service workers,
 * canvases, video frames): what a message's `source` is, and what `structuredClone` transfers.
 */
const OWN_TYPES: Readonly<Record<string, string>> = {
	Navigator: "interface Navigator {\n  readonly product: string;\n  readonly userAgent: string;\n}",
	MessageEventSource: "type MessageEventSource = MessagePort;",
	Transferable:
		"type Transferable = MessagePort | ReadableStream | WritableStream | TransformStream | ArrayBuffer;",
};

/** What the baseline adds to the thread's own `console`. */
const CONSOLE =
	"interface Console {\n  assert(condition?: boolean, ...data: unknown[]): void;\n  trace(...data: unknown[]): void;\n}";

/** The worker's declarations, by name. */
interface Library {
	interfaces: Map<string, ts.InterfaceDeclaration[]>;
	aliases: Map<string, ts.TypeAliasDeclaration>;
	variables: Map<string, ts.VariableDeclaration>;
	functions: Map<string, ts.FunctionDeclaration[]>;
	version: string;
}

/** Each `push` to a list of a map, made when first needed. */
function add<T>(map: Map<string, T[]>, name: string, value: T): void {
	const list = map.get(name);
	if (list) list.push(value);
	else map.set(name, [value]);
}

/** TypeScript's web types without the DOM, by name. */
function readLibrary(): Library {
	const require = createRequire(import.meta.url);
	const folder = path.dirname(require.resolve("typescript/lib/lib.webworker.d.ts"));
	const library: Library = {
		interfaces: new Map(),
		aliases: new Map(),
		variables: new Map(),
		functions: new Map(),
		version: ts.versionMajorMinor,
	};
	for (const file of LIBS) {
		const text = fs.readFileSync(path.join(folder, file), "utf8");
		const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		for (const statement of source.statements) {
			if (ts.isInterfaceDeclaration(statement))
				add(library.interfaces, statement.name.text, statement);
			else if (ts.isTypeAliasDeclaration(statement))
				library.aliases.set(statement.name.text, statement);
			else if (ts.isFunctionDeclaration(statement) && statement.name)
				add(library.functions, statement.name.text, statement);
			else if (ts.isVariableStatement(statement))
				for (const declaration of statement.declarationList.declarations)
					if (ts.isIdentifier(declaration.name))
						library.variables.set(declaration.name.text, declaration);
		}
	}
	return library;
}

/** The globals each import installs on either thread, by subpath, from the entries' snapshot. */
export function installedGlobals(): Map<string, string[]> {
	const snapshot = fs.readFileSync(SNAPSHOT, "utf8");
	const installed = new Map<string, Set<string>>();
	for (const match of snapshot.matchAll(
		/exports\[`import "@sohedra\/lynx-polyfill([^"]*)" > on the [\w-]+: its globals, and its size within budget 1`\] = `\n?\[([^\]]*)\]/g,
	)) {
		const names = installed.get(match[1]!) ?? new Set<string>();
		for (const name of match[2]!.matchAll(/"([^"]*)"/g)) names.add(name[1]!);
		installed.set(match[1]!, names);
	}
	return new Map([...installed].map(([subpath, names]) => [subpath, [...names].sort()]));
}

const printer = ts.createPrinter({ removeComments: true });

/** A declaration as text, without its comments. */
function print(node: ts.Node): string {
	return printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
}

/** The names of the worker's types that `node` refers to, `typeof` queries aside. */
function referencedTypes(node: ts.Node, library: Library): string[] {
	const names: string[] = [];
	const visit = (child: ts.Node): void => {
		if (ts.isTypeReferenceNode(child) && ts.isIdentifier(child.typeName))
			names.push(child.typeName.text);
		else if (ts.isExpressionWithTypeArguments(child) && ts.isIdentifier(child.expression))
			names.push(child.expression.text);
		ts.forEachChild(child, visit);
	};
	visit(node);
	return names.filter(
		(name) => library.interfaces.has(name) || library.aliases.has(name) || name in OWN_TYPES,
	);
}

/** The declaration of a global, as `declare global` holds it. */
function globalDeclaration(name: string, library: Library): string {
	const own = OWN_GLOBALS[name];
	if (own !== undefined) return own;
	const variable = library.variables.get(name);
	if (variable) {
		const list = variable.parent as ts.VariableDeclarationList;
		const keyword = list.flags & ts.NodeFlags.Const ? "const" : "var";
		return `${keyword} ${print(variable)};`;
	}
	const functions = library.functions.get(name);
	if (functions) return functions.map((fn) => print(fn).replace(/^declare /, "")).join("\n");
	throw new Error(
		`TypeScript's lib.webworker.d.ts declares no global ${name}: write its declaration in OWN_GLOBALS.`,
	);
}

/** The nodes a global's declaration is made of, for following what it names. */
function globalNodes(name: string, library: Library): ts.Node[] {
	if (name in OWN_GLOBALS) return [];
	const variable = library.variables.get(name);
	if (variable) return [variable];
	return library.functions.get(name) ?? [];
}

/** The text of every type `roots` name, and those they name, in the worker's order. */
function typesNamed(roots: readonly string[], library: Library): string[] {
	const seen = new Set<string>();
	const queue = [...roots];
	while (queue.length > 0) {
		const name = queue.shift()!;
		if (seen.has(name)) continue;
		seen.add(name);
		if (name in OWN_TYPES) {
			const text = OWN_TYPES[name]!;
			for (const other of Object.keys(OWN_TYPES).concat([...library.interfaces.keys()]))
				if (other !== name && new RegExp(`\\b${other}\\b`).test(text)) queue.push(other);
			continue;
		}
		const nodes: ts.Node[] = library.interfaces.get(name) ?? [];
		const alias = library.aliases.get(name);
		for (const node of alias ? [alias] : nodes) queue.push(...referencedTypes(node, library));
	}
	const texts: string[] = [];
	for (const name of [...seen].sort()) {
		if (name in OWN_TYPES) texts.push(OWN_TYPES[name]!);
		else if (library.aliases.has(name)) texts.push(print(library.aliases.get(name)!));
		else for (const node of library.interfaces.get(name)!) texts.push(print(node));
	}
	return texts.map((text) => text.replace(/^declare /, ""));
}

/** A file of declarations: its path from the package's folder, and its text. */
export interface TypesFile {
	path: string;
	text: string;
}

/** Formats a declaration file as the repository's formatter would. */
async function formatted(file: string, text: string): Promise<string> {
	const result = await format(file, text, { useTabs: true });
	if (result.errors.length > 0)
		throw new Error(`oxfmt could not format ${file}: ${JSON.stringify(result.errors)}`);
	return result.code;
}

/** Every file `pnpm -F @sohedra/lynx-polyfill generate` writes. */
export async function generateTypes(): Promise<TypesFile[]> {
	const library = readLibrary();
	const installed = installedGlobals();
	const source = `TypeScript ${library.version}'s lib.webworker.d.ts`;
	const header = (what: string): string =>
		[
			`// Generated from ${source} by \`${GENERATE_COMMAND}\`: do not edit.`,
			`// ${what}`,
			"// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.",
		].join("\n");
	const roots = new Set<string>();
	const files: TypesFile[] = [];
	for (const [subpath, globals] of installed) {
		if (globals.length === 0) continue;
		for (const name of globals)
			for (const node of globalNodes(name, library))
				for (const type of referencedTypes(node, library)) roots.add(type);
		if (globals.includes("navigator")) roots.add("Navigator");
		for (const name of ["addEventListener", "removeEventListener", "dispatchEvent", "onerror"])
			if (globals.includes(name))
				for (const type of ["EventListenerOrEventListenerObject", "AddEventListenerOptions"])
					roots.add(type);
		if (globals.includes("onerror")) roots.add("ErrorEvent");
		const declarations = globals.map((name) => globalDeclaration(name, library));
		if (subpath === "") declarations.push(CONSOLE);
		const text = [
			header(
				`What \`import "@sohedra/lynx-polyfill${subpath}"\` installs on either thread: its globals' types.`,
			),
			'/// <reference path="./web.d.ts" />',
			`declare global {\n${declarations.join("\n")}\n}`,
			"export {};",
		].join("\n\n");
		files.push({ path: typesFile(subpath), text });
	}
	const web = [
		header(
			"The interfaces and types the package's globals name, for every import's types: none of them is a value.",
		),
		...typesNamed([...roots], library),
	].join("\n\n");
	files.push({ path: WEB_TYPES, text: web });
	return Promise.all(
		files.map(async ({ path: file, text }) => ({
			path: file,
			text: await formatted(file, `${text}\n`),
		})),
	);
}
