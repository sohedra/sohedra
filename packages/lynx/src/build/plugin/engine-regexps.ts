// Regular expressions Lynx's engine refuses: PrimJS has no `v` or `d` flag, no modifiers (`(?i:…)`)
// and no two groups of one name (ES2022 to ES2025). A literal of one fails the whole thread's
// script as it parses, so no page shows; `RegExp` with one throws where it runs. SWC lowers none of
// them (it writes a `v` literal as a `RegExp` call), so the build stops at each, in each module as
// the loaders left it: the compiled output of a component too, and dependencies'.

import fs from "node:fs";
import path from "node:path";

import type { Rspack } from "@rsbuild/core";

import type { ScriptParser } from "../../svelte/build/index.ts";
import { scriptParser } from "../../svelte/build/index.ts";
import { PACKAGE_NAME } from "../../wire/index.ts";
import type { RegExpSyntax } from "../diagnostics/catalogue.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { Place } from "../diagnostics/messages.ts";

/** A regular expression the engine refuses: its text, why, and where it starts in the code. */
export interface RefusedRegExp {
	text: string;
	syntax: RegExpSyntax;
	start: number;
}

/** Text that may hold one: a flag after a slash or in a string, a group's name, a modifier. */
const MAYBE = /\/[dgimsuyv]*[dv]|["'][dgimsuyv]*[dv][dgimsuyv]*["']|\(\?(?:<[^=!]|[ims-])/;

/** A modifier group: `(?i:`, `(?-m:`, `(?ims-s:`, not escaped. */
const MODIFIER = /(?<!\\)(?:\\\\)*\(\?(?:[ims]+(?:-[ims]*)?|-[ims]+):/;

/** A named group's name, not escaped and not in a class. */
const GROUP_NAME = /\\.|\[(?:\\.|[^\]\\])*\]|\(\?<([^>=!][^>]*)>/g;

/** Why the engine refuses a pattern with these flags, if it does. */
function syntaxOf(pattern: string | undefined, flags: string): RegExpSyntax | undefined {
	if (flags.includes("v")) return "v_flag";
	if (flags.includes("d")) return "d_flag";
	if (pattern === undefined) return undefined;
	if (MODIFIER.test(pattern)) return "modifier";
	const names = [...pattern.matchAll(GROUP_NAME)].flatMap((match) => match[1] ?? []);
	if (new Set(names).size < names.length) return "duplicate_group";
	return undefined;
}

/** A node of the parser's tree, as far as this reads it. */
interface Node {
	type: string;
	start: number;
	end: number;
	value?: unknown;
	regex?: { pattern: string; flags: string };
	callee?: Node;
	name?: string;
	arguments?: Node[];
}

/** The value of a string literal, if `node` is one. */
function stringOf(node: Node | undefined): string | undefined {
	return node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

/** The regular expressions the engine refuses in `code`: none where it does not parse. */
export function refusedRegExps(code: string, parse: ScriptParser): RefusedRegExp[] {
	if (!MAYBE.test(code)) return [];
	let program: unknown;
	try {
		program = parse(code, false);
	} catch {
		// A module the parser can't read is not this check's to report: the bundler reports it.
		return [];
	}
	const found: RefusedRegExp[] = [];
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		if (typeof value !== "object" || value === null) return;
		// Boundary: the parser's tree is ESTree, untyped here.
		const node = value as Node;
		let syntax: RegExpSyntax | undefined;
		if (node.regex) syntax = syntaxOf(node.regex.pattern, node.regex.flags);
		else if (
			(node.type === "CallExpression" || node.type === "NewExpression") &&
			node.callee?.type === "Identifier" &&
			node.callee.name === "RegExp"
		)
			syntax = syntaxOf(stringOf(node.arguments?.[0]), stringOf(node.arguments?.[1]) ?? "");
		if (syntax) found.push({ text: code.slice(node.start, node.end), syntax, start: node.start });
		for (const [key, child] of Object.entries(node)) if (key !== "loc") visit(child);
	};
	visit(program);
	return found;
}

/**
 * Where `text` is in `file` as written, which the loaders may have changed: the place of its first
 * appearance, or of its pattern when SWC wrote a literal as a call.
 */
function placeOf(file: string, found: RefusedRegExp): Place | undefined {
	let text: string;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		return undefined;
	}
	const pattern = /^(?:new )?RegExp\("((?:\\.|[^"\\])*)"/.exec(found.text)?.[1];
	const needles = [
		found.text,
		...(pattern === undefined ? [] : [`/${JSON.parse(`"${pattern}"`) as string}/`]),
	];
	for (const needle of needles) {
		const offset = text.indexOf(needle);
		if (offset !== -1) return placeAt({ file, text }, offset);
	}
	return undefined;
}

/** Fails the build at each regular expression the engine refuses, once per place. */
export class EngineRegExpsPlugin {
	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:engine-regexps`;
		const parse = scriptParser(compiler.context);
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			compilation.hooks.finishModules.tap(name, (modules) => {
				const reported = new Set<string>();
				for (const module of modules) {
					// Boundary: a normal module has its file, and its code as the loaders left it.
					const { resource } = module as { resource?: unknown };
					const code = module.originalSource()?.source();
					if (typeof resource !== "string" || typeof code !== "string") continue;
					for (const found of refusedRegExps(code, parse)) {
						const place = placeOf(resource, found);
						const key = place?.where ?? `${resource}\0${found.text}`;
						if (reported.has(key)) continue;
						reported.add(key);
						const file = path.relative(compiler.context, resource);
						const { message } = buildError({
							code: "regexp_refused",
							details: { regexp: found.text, syntax: found.syntax },
							place: place && { ...place, where: place.where.replace(resource, file) },
						});
						compilation.errors.push(
							Object.assign(new compiler.webpack.WebpackError(message), { stack: "" }),
						);
					}
				}
			});
		});
	}
}
