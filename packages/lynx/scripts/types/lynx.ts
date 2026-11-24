// Writes the global `lynx` as Lynx declares it: every member of `@lynx-js/types`' `CommonLynx` and of
// each thread's `Lynx`, with Lynx's doc comment, which threads have it, and the file of
// `@lynx-js/types` it comes from; and the types those members name, copied as Lynx declares them.
// Where a member is typed for ReactLynx, `LYNX_REPLACED` gives the form a Svelte app calls it in.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/** Where `@lynx-js/types` is, and its version. */
function lynxTypes(): { root: string; version: string } {
	const folder = fileURLToPath(new URL("../../node_modules/@lynx-js/types/", import.meta.url));
	const manifest = JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8")) as {
		version: string;
	};
	return { root: path.join(folder, "types"), version: manifest.version };
}

/** The files whose `Lynx` interfaces hold the members, with the threads each file's members are on. */
const SOURCES = [
	{ file: "common/lynx.d.ts", name: "CommonLynx", threads: "Both threads." },
	{ file: "background-thread/lynx.d.ts", name: "Lynx", threads: "Background thread only." },
	{ file: "main-thread/lynx.d.ts", name: "Lynx", threads: "Main thread only." },
] as const;

/**
 * Lynx's types written here in another form, by name: what names ReactLynx, or the web's DOM types
 * that `@lynx-js/types` reads from the DOM's lib, which Lynx's threads and the base tsconfig lack.
 */
const LYNX_REPLACED: Readonly<Record<string, string>> = {
	// lynx-core reads `componentId` of its first argument, a ReactLynx component, and observes within
	// that component (lynx-core's app/app.ts, setupIntersectionApi); a Svelte page is one component.
	CreateIntersectionObserverFunc: [
		"/**",
		" * Makes an observer of where elements are against the page or the screen. Pass `{}`: a Svelte",
		" * page has no components of Lynx's own, and `{}` observes the whole page.",
		" */",
		"type CreateIntersectionObserverFunc = (",
		"\tcomponent: { componentId?: string },",
		"\toptions?: { thresholds?: number[]; initialRatio?: number; observeAll?: boolean },",
		") => IntersectionObserver;",
	].join("\n"),
};

/**
 * The DOM's types that Lynx's own name for lynx-core's `fetch`, `EventSource` and `ReadableStream`,
 * as the shapes lynx-core gives (lynx-core's modules/fetch): the web's, from
 * `@sohedra/lynx-polyfill`, are what an app uses instead.
 */
const DOM_STAND_INS: string = [
	"/** A URL, as lynx-core's `fetch` takes it: its text. */",
	"type URL = string;",
	"/** What lynx-core's `fetch` takes: a URL, or a request. */",
	"type RequestInfo = string | Request;",
	"/** The headers of lynx-core's `fetch`. */",
	"type Headers = Record<string, string>;",
	"type HeadersInit = Record<string, string>;",
	"/** A body lynx-core's `fetch` sends. */",
	"type BodyInit = string | ArrayBuffer;",
	"interface ResponseInit {\n\tstatus?: number;\n\tstatusText?: string;\n\theaders?: HeadersInit;\n}",
	"/** A response's body, as lynx-core streams it. */",
	"type ReadableStream = LynxReadableStream<Uint8Array>;",
	"/** An event of lynx-core's `EventSource`. */",
	"interface Event {\n\treadonly type: string;\n}",
	"/** The events of lynx-core's `EventSource`, by name. */",
	"interface EventSourceEventMap {\n\terror: Event;\n\tmessage: MessageEvent;\n\topen: Event;\n}",
].join("\n");

/** Lynx's types the forms above name, which the members alone would not reach. */
const NAMED_BY_REPLACEMENTS: readonly string[] = ["IntersectionObserver", "Request"];

/** What a member's doc adds for a Svelte app, by member. */
const MEMBER_NOTES: Readonly<Record<string, string>> = {
	createIntersectionObserver:
		"In a Svelte app, pass `{}` for the component: `lynx.createIntersectionObserver({})`.",
};

/** Each JSDoc comment that leads `node`, as written. */
function docOf(node: ts.Node, source: ts.SourceFile): string | undefined {
	const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	const docs = ranges
		.map((range) => source.text.slice(range.pos, range.end))
		.filter((text) => text.startsWith("/**"));
	return docs.at(-1);
}

/** A doc comment's lines, without its delimiters and stars. */
function docLines(doc: string | undefined): string[] {
	if (doc === undefined) return [];
	return doc
		.replace(/^\/\*\*/, "")
		.replace(/\*\/$/, "")
		.split("\n")
		.map((line) => line.replace(/^\s*\*? ?/, "").trimEnd())
		.filter((line, index, all) => line !== "" || (index > 0 && index < all.length - 1));
}

/** `lines` as a doc comment, at `indent`. */
function docComment(lines: readonly string[], indent: string): string {
	return `${indent}/**\n${lines.map((line) => `${indent} *${line ? ` ${line}` : ""}`).join("\n")}\n${indent} */\n`;
}

/** The text of `types/generated/lynx.d.ts`, before formatting. */
export function writeLynx(): string {
	const { root, version } = lynxTypes();
	const program = ts.createProgram([path.join(root, "index.d.ts")], {
		strict: true,
		skipLibCheck: true,
		noEmit: true,
		types: [],
		lib: ["lib.es2021.d.ts"],
	});
	const checker = program.getTypeChecker();
	const inLynx = (file: string): boolean => path.resolve(file).startsWith(root);

	/** Each member, by name: its declarations, the file they are in, and the threads that have it. */
	const members = new Map<
		string,
		{ nodes: ts.TypeElement[]; file: string; threads: string; text?: string; also?: ts.Node }
	>();
	for (const { file, name, threads } of SOURCES) {
		const source = program.getSourceFile(path.join(root, file));
		const declaration = source?.statements.find(
			(statement): statement is ts.InterfaceDeclaration =>
				ts.isInterfaceDeclaration(statement) && statement.name.text === name,
		);
		if (!declaration) throw new Error(`@lynx-js/types no longer declares ${name} in ${file}.`);
		const own = new Map<string, ts.TypeElement[]>();
		for (const member of declaration.members) {
			const key = member.name?.getText(source);
			if (key === undefined) continue;
			own.set(key, [...(own.get(key) ?? []), member]);
		}
		for (const [key, nodes] of own) {
			const known = members.get(key);
			// A member Lynx declares for both threads, and again for one, is both threads': the
			// common declaration is what both have.
			if (known?.threads === SOURCES[0].threads) continue;
			if (known) {
				// Each thread's own (`performance`): what the main thread's has, and the background's
				// more, which the main thread lacks.
				const main = nodes[0]!;
				const background = known.nodes[0]!;
				if (!ts.isPropertySignature(main) || !ts.isPropertySignature(background))
					throw new Error(`@lynx-js/types declares ${key} on each thread, not as a property.`);
				const mainType = main.type!.getText(main.getSourceFile());
				const backgroundType = background.type!.getText(background.getSourceFile());
				members.set(key, {
					nodes,
					file: `${known.file}\` and \`types/${file}`,
					threads: `Both threads; the main thread's has only what \`${mainType}\` has.`,
					text: `${key}: ${mainType} & Partial<Omit<${backgroundType}, keyof ${mainType}>>;`,
					also: background,
				});
				continue;
			}
			members.set(key, { nodes, file, threads });
		}
	}

	/** Lynx's declarations of the types the members name, by name. */
	const declarations = new Map<
		string,
		ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration
	>();
	const queue: ts.Node[] = [...members.values()].flatMap(({ nodes, also }) =>
		also ? [...nodes, also] : nodes,
	);
	for (const name of NAMED_BY_REPLACEMENTS) {
		const found = program
			.getSourceFiles()
			.filter((file) => inLynx(file.fileName))
			.flatMap((file) => file.statements)
			.find(
				(statement) =>
					(ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
					statement.name.text === name,
			);
		if (!found) throw new Error(`@lynx-js/types no longer declares ${name}.`);
		queue.push(found);
	}
	for (const node of queue)
		if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
			declarations.set(node.name.text, node);
	while (queue.length > 0) {
		const node = queue.shift()!;
		const visit = (child: ts.Node): void => {
			const name =
				ts.isTypeReferenceNode(child) && ts.isIdentifier(child.typeName)
					? child.typeName
					: ts.isExpressionWithTypeArguments(child) && ts.isIdentifier(child.expression)
						? child.expression
						: undefined;
			if (name) {
				let symbol = checker.getSymbolAtLocation(name);
				if (symbol && symbol.flags & ts.SymbolFlags.Alias)
					symbol = checker.getAliasedSymbol(symbol);
				for (const found of symbol?.declarations ?? []) {
					if (!inLynx(found.getSourceFile().fileName)) continue;
					if (
						!ts.isInterfaceDeclaration(found) &&
						!ts.isTypeAliasDeclaration(found) &&
						!ts.isEnumDeclaration(found)
					)
						continue;
					const key = found.name.text;
					const before = declarations.get(key);
					if (before && before !== found && !ts.isInterfaceDeclaration(found))
						throw new Error(`@lynx-js/types declares two types named ${key}.`);
					if (before === found) continue;
					declarations.set(key, found);
					if (!(key in LYNX_REPLACED)) queue.push(found);
				}
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
	}

	const types = [...declarations.keys()].sort().map((name) => {
		const replaced = LYNX_REPLACED[name];
		if (replaced !== undefined) return replaced;
		const node = declarations.get(name)!;
		const source = node.getSourceFile();
		const doc = docLines(docOf(node, source));
		// A declaration file's enum takes `declare`; an interface or a type needs none.
		const text = node
			.getText(source)
			.replace(/^export\s+/, "")
			.replace(/^declare\s+/, "")
			.replace(/^(?=(?:const\s+)?enum\b)/, "declare ");
		return `${doc.length > 0 ? docComment(doc, "") : ""}${text}`;
	});

	const lines = [...members.entries()].sort(([a], [b]) => a.localeCompare(b));
	const body = lines.flatMap(([key, { nodes, file, threads, text }]) =>
		nodes.map((node) => {
			const source = node.getSourceFile();
			const doc = docLines(docOf(node, source));
			// Before the tags, which would take the notes as their own text.
			const tags = doc.findIndex((line) => line.startsWith("@"));
			const at = tags === -1 ? doc.length : tags;
			const notes = [
				...(MEMBER_NOTES[key] === undefined ? [] : [MEMBER_NOTES[key]]),
				threads,
				`Lynx's declaration: \`@lynx-js/types\`, \`types/${file}\`.`,
			];
			const lines = [...doc.slice(0, at), ...(at > 0 ? [""] : []), ...notes, ...doc.slice(at)];
			return `${docComment(lines, "\t\t")}\t\t${text ?? node.getText(source)}`;
		}),
	);

	return `${[
		[
			`// Generated from @lynx-js/types ${version} by \`pnpm -F @sohedra/lynx generate\`. Do not edit:`,
			"// change scripts/types/ and generate again. The doc comments are Lynx's, from",
			"// @lynx-js/types (Apache License 2.0).",
			"//",
			"// The global `lynx`, as Lynx declares it for each thread, and the types its members name.",
		].join("\n"),
		'import type { GlobalProps } from "@sohedra/lynx/host";',
		DOM_STAND_INS,
		...types.filter((text) => !/^(?:interface|type) GlobalProps\b/m.test(text)),
		[
			"declare global {",
			"\t/**",
			"\t * Lynx's `lynx` object: what each thread has of it, as Lynx declares it. Each member says which",
			"\t * thread has it; the build reports a member read on a thread without it. Add to it, as",
			"\t * `declare global { interface Lynx { … } }`, for a member a newer Lynx has.",
			"\t */",
			"\tinterface Lynx {",
			...body,
			"\t}",
			"",
			"\t/** Lynx's `lynx` object. Both threads. */",
			"\tvar lynx: Lynx;",
			"}",
		].join("\n"),
		"export {};",
	].join("\n\n")}\n`;
}
