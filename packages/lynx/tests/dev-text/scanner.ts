// What a production build must not contain: the text of every message the code builds only for
// development. The list is read from the sources with the TypeScript parser and checker, with no
// regular expression over code.
//
// A string is development text when it is in code that runs only under a development guard:
//
//   - the branch of an `if` or a `? :`, or the right side of `&&` / `||`, that runs only when a
//     condition that reads `__DEV__`, the `dev` option or value, or `process.env.NODE_ENV` against
//     "production" says development (`!`, `&&` and `||` of such conditions included). A false
//     condition says development only when it can be false in no production build: the `else` of
//     `!__DEV__` is development-only, the `else` of `!__DEV__ && x` is not;
//   - the statements after `if (<condition>) return;` in the same block, when that condition being
//     false says development;
//   - the whole of a named function (a `function`, or a `const` holding an arrow or function
//     expression) every one of whose references is in such code or in another such function.
//     References are resolved by the type checker, across files and through imports and re-exports.
//
// A text that also appears in code that is not development-only (a message an error throws in every
// build) is not listed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** The folders whose code ships in a thread's bundle, relative to the package. */
export const SHIPPED_DIRS: string[] = [
	"src/background",
	"src/main-thread",
	"src/first-frame",
	"src/wire",
	"src/svelte/runtime",
	"src/gesture",
	"src/env",
];

/**
 * The shortest fragment kept. Short enough for the fixed parts of
 * `describeOp`'s lines ("update the list "), long enough that a fragment is
 * not an ordinary word a bundle has for other reasons.
 */
export const MIN_FRAGMENT = 12;

export interface DevFragment {
	text: string;
	file: string;
	line: number;
}

type Polarity = "dev" | "prod" | undefined;

const isIdent = (node: ts.Node, name: string): boolean =>
	ts.isIdentifier(node) && node.text === name;

/** Does `node` read `process.env.NODE_ENV`? */
function isNodeEnv(node: ts.Node): boolean {
	return (
		ts.isPropertyAccessExpression(node) &&
		node.name.text === "NODE_ENV" &&
		ts.isPropertyAccessExpression(node.expression) &&
		node.expression.name.text === "env" &&
		isIdent(node.expression.expression, "process")
	);
}

/**
 * What a condition being `value` says: this is a development build, a production build, or
 * nothing. `!__DEV__ && x` being true says production, but being false says nothing.
 */
function says(node: ts.Expression, value: boolean): Polarity {
	if (ts.isParenthesizedExpression(node)) return says(node.expression, value);
	const build = (dev: boolean): Polarity => (dev === value ? "dev" : "prod");
	if (isIdent(node, "__DEV__") || isIdent(node, "dev")) return build(true);
	if (ts.isPropertyAccessExpression(node) && node.name.text === "dev") return build(true);
	if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
		return says(node.operand, !value);
	}
	if (ts.isBinaryExpression(node)) {
		const op = node.operatorToken.kind;
		const and = op === ts.SyntaxKind.AmpersandAmpersandToken;
		if (and || op === ts.SyntaxKind.BarBarToken) {
			const left = says(node.left, value);
			const right = says(node.right, value);
			// `&&` true and `||` false hold both sides to `value`: either one says what the build is.
			// Otherwise only one side may hold, so only what both say counts.
			return and === value ? (left ?? right) : left === right ? left : undefined;
		}
		const equal =
			op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
		const unequal =
			op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
			op === ts.SyntaxKind.ExclamationEqualsToken;
		if (equal || unequal) {
			const [env, other] = isNodeEnv(node.left) ? [node.left, node.right] : [node.right, node.left];
			if (isNodeEnv(env) && ts.isStringLiteralLike(other)) {
				return build(equal !== (other.text === "production"));
			}
		}
	}
	return undefined;
}

const exits = (statement: ts.Statement): boolean => {
	if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
	return ts.isBlock(statement) && statement.statements.some(exits);
};

/** Fixed text of a string or template literal node, or undefined for any other node. */
function fixedParts(node: ts.Node): string[] | undefined {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
	if (ts.isTemplateExpression(node)) {
		return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
	}
	return undefined;
}

/**
 * Fragments of a string value: split where a minifier may write the text
 * another way (quotes, backslashes, control or non-ASCII characters), keeping
 * the pieces of at least MIN_FRAGMENT characters that have a space.
 */
function fragmentsOf(value: string): string[] {
	const pieces: string[] = [];
	let piece = "";
	for (const char of value) {
		const code = char.codePointAt(0)!;
		if (
			code < 0x20 ||
			code > 0x7e ||
			char === '"' ||
			char === "'" ||
			char === "`" ||
			char === "\\"
		) {
			pieces.push(piece);
			piece = "";
		} else piece += char;
	}
	pieces.push(piece);
	// A piece with no space is a name ("setAttribute"), which a bundle has for other reasons.
	return pieces.filter((text) => text.length >= MIN_FRAGMENT && text.includes(" "));
}

function listFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return listFiles(full);
		return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [full] : [];
	});
}

interface Region {
	start: number;
	end: number;
	file: string;
}

/** Every development-only fragment of the shipped sources (see the top of this file). */
export function scanDevText(dirs: string[] = SHIPPED_DIRS): DevFragment[] {
	const files = dirs.flatMap((dir) => listFiles(path.resolve(root, dir)));
	const program = ts.createProgram(files, {
		allowImportingTsExtensions: true,
		noEmit: true,
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		skipLibCheck: true,
		types: [],
	});
	const checker = program.getTypeChecker();
	// TypeScript names files with `/`, which Windows' paths have not.
	const scanned = new Set(files.map((file) => file.split(path.sep).join("/")));
	const sources = program.getSourceFiles().filter((source) => scanned.has(source.fileName));

	// 1. The code that runs only in development, from the guards.
	const guarded: Region[] = [];
	const mark = (node: ts.Node, source: ts.SourceFile) =>
		guarded.push({ start: node.getStart(source), end: node.end, file: source.fileName });
	for (const source of sources) {
		const visit = (node: ts.Node): void => {
			if (ts.isIfStatement(node) || ts.isConditionalExpression(node)) {
				const [condition, yes, no] = ts.isIfStatement(node)
					? [node.expression, node.thenStatement, node.elseStatement]
					: [node.condition, node.whenTrue, node.whenFalse];
				if (says(condition, true) === "dev") mark(yes, source);
				if (says(condition, false) === "dev" && no) mark(no, source);
			} else if (ts.isBinaryExpression(node)) {
				// The right side runs when the left is true (`&&`) or false (`||`).
				const op = node.operatorToken.kind;
				if (op === ts.SyntaxKind.AmpersandAmpersandToken && says(node.left, true) === "dev")
					mark(node.right, source);
				if (op === ts.SyntaxKind.BarBarToken && says(node.left, false) === "dev")
					mark(node.right, source);
			}
			if (ts.isBlock(node) || ts.isSourceFile(node)) {
				const statements = node.statements;
				statements.forEach((statement, index) => {
					if (
						ts.isIfStatement(statement) &&
						!statement.elseStatement &&
						says(statement.expression, false) === "dev" &&
						exits(statement.thenStatement)
					) {
						const rest = statements.slice(index + 1);
						if (rest.length) {
							guarded.push({
								start: rest[0]!.getStart(source),
								end: rest[rest.length - 1]!.end,
								file: source.fileName,
							});
						}
					}
				});
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	const within = (regions: Region[], node: ts.Node, source: ts.SourceFile) => {
		const start = node.getStart(source);
		return regions.some(
			(region) =>
				region.file === source.fileName && region.start <= start && node.end <= region.end,
		);
	};

	// 2. The named functions only development code uses: the greatest set whose
	// references all lie in guarded code or inside a member of the set.
	interface Candidate {
		symbol: ts.Symbol;
		body: ts.Node;
		source: ts.SourceFile;
		refs: { node: ts.Identifier; source: ts.SourceFile }[];
	}
	const candidates = new Map<ts.Symbol, Candidate>();
	for (const source of sources) {
		const visit = (node: ts.Node): void => {
			let name: ts.Identifier | undefined;
			let body: ts.Node | undefined;
			if (ts.isFunctionDeclaration(node) && node.name && node.body) {
				name = node.name;
				body = node;
			} else if (
				ts.isVariableDeclaration(node) &&
				ts.isIdentifier(node.name) &&
				node.initializer &&
				(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
			) {
				name = node.name;
				body = node;
			}
			const symbol = name && checker.getSymbolAtLocation(name);
			if (name && body && symbol) candidates.set(symbol, { symbol, body, source, refs: [] });
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	for (const source of sources) {
		const visit = (node: ts.Node): void => {
			const skip =
				ts.isImportSpecifier(node) || ts.isExportSpecifier(node) || ts.isImportClause(node);
			if (!skip && ts.isIdentifier(node)) {
				// `{ name }` is a use of the value `name`, which the checker names apart.
				let symbol = ts.isShorthandPropertyAssignment(node.parent)
					? checker.getShorthandAssignmentValueSymbol(node.parent)
					: checker.getSymbolAtLocation(node);
				if (symbol && symbol.flags & ts.SymbolFlags.Alias)
					symbol = checker.getAliasedSymbol(symbol);
				const candidate = symbol && candidates.get(symbol);
				// The name in the declaration is not a use.
				const declared =
					candidate &&
					(ts.isFunctionDeclaration(node.parent) || ts.isVariableDeclaration(node.parent)) &&
					node.parent.name === node;
				if (candidate && !declared) candidate.refs.push({ node, source });
			}
			if (!skip) ts.forEachChild(node, visit);
		};
		visit(source);
	}
	const devOnly = new Set(
		[...candidates.values()].filter((candidate) => candidate.refs.length > 0),
	);
	for (let changed = true; changed;) {
		changed = false;
		const regions: Region[] = [
			...guarded,
			...[...devOnly].map((candidate) => ({
				start: candidate.body.getStart(candidate.source),
				end: candidate.body.end,
				file: candidate.source.fileName,
			})),
		];
		for (const candidate of devOnly) {
			if (candidate.refs.every((ref) => within(regions, ref.node, ref.source))) continue;
			devOnly.delete(candidate);
			changed = true;
		}
	}
	const regions: Region[] = [
		...guarded,
		...[...devOnly].map((candidate) => ({
			start: candidate.body.getStart(candidate.source),
			end: candidate.body.end,
			file: candidate.source.fileName,
		})),
	];

	// 3. The text in those regions, less any text that ships elsewhere.
	const dev = new Map<string, DevFragment>();
	const shipped = new Set<string>();
	for (const source of sources) {
		const visit = (node: ts.Node): void => {
			const parts = fixedParts(node);
			if (parts) {
				const isDev = within(regions, node, source);
				for (const part of parts) {
					for (const text of fragmentsOf(part)) {
						if (!isDev) shipped.add(text);
						else if (!dev.has(text)) {
							const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
							dev.set(text, {
								text,
								// With `/` between folders on every system, as Windows' `relative()` has not.
								file: path.relative(root, source.fileName).replaceAll("\\", "/"),
								line,
							});
						}
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return [...dev.values()].filter(
		({ text }) => ![...shipped].some((other) => other.includes(text)),
	);
}
