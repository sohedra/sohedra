// A component's main-thread functions written in TypeScript, on the main thread: the main thread's
// copy ends with their bodies copied as written, after Svelte's output, which is JavaScript. Node's
// own stripper takes their types out (each becomes spaces, so every position and the map made
// against the text as written stay), and the whole copy is read as JavaScript. What is more than a
// type (an `enum`, a `namespace`) is refused with its place: Svelte strips a component's script,
// but never sees a main-thread function's body.

import * as nodeModule from "node:module";

import { nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { SourceText } from "../diagnostics/messages.ts";
import { nodeVersion, withoutWarnings } from "../globals.ts";

/** Node's `module.stripTypeScriptTypes`, as far as this calls it. */
type TypeStripper = (code: string, options: { mode: "strip" }) => string;

/** Node's stripper, or `undefined` on a Node without it (older than 22.13). */
export function nodeTypeStripper(): TypeStripper | undefined {
	// Boundary: the function is newer than the oldest Node the build runs on, and its types.
	const strip = (nodeModule as { stripTypeScriptTypes?: unknown }).stripTypeScriptTypes;
	return typeof strip === "function" ? (strip as TypeStripper) : undefined;
}

/** TypeScript that is more than a type: what Node refuses to strip, and what to write instead. */
const MORE_THAN_A_TYPE: Readonly<Record<string, { feature: string; instead: string }>> = {
	TSEnumDeclaration: {
		feature: "an `enum`",
		instead: "an object of its values (`const Color = { Red: 0 } as const`)",
	},
	TSModuleDeclaration: {
		feature: "a `namespace`",
		instead: "its declarations, at the top of the script or in a module of their own",
	},
	TSParameterProperty: {
		feature: "a parameter property",
		instead: "a field that the constructor assigns (`this.size = size`)",
	},
	TSImportEqualsDeclaration: { feature: "`import =`", instead: "an `import` declaration" },
	Decorator: { feature: "a decorator", instead: "a call of the function it names" },
};

/** A piece of TypeScript that is more than a type, by its offset in the component. */
export interface Unsupported {
	at: number;
	feature: string;
	instead: string;
}

/** What the copied text of a component's main-thread functions holds, by its tree. */
interface CopiedTypeScript {
	/** Whether it holds TypeScript at all. */
	typed: boolean;
	/** The TypeScript in it that is more than a type, in the order it is written. */
	unsupported: Unsupported[];
}

/** What the ranges `copies` of a component, whose tree is `tree`, hold of TypeScript. */
export function copiedTypeScript(
	tree: readonly unknown[],
	copies: readonly [number, number][],
): CopiedTypeScript {
	const inCopy = (node: AnyNode): boolean =>
		typeof node.start === "number" &&
		copies.some(([start, end]) => node.start! >= start && node.start! < end);
	let typed = false;
	const unsupported: Unsupported[] = [];
	for (const node of nodes(tree)) {
		const type = typeof node.type === "string" ? node.type : "";
		if (!(type.startsWith("TS") || type === "Decorator") || !inCopy(node)) continue;
		typed = true;
		const more = MORE_THAN_A_TYPE[type];
		if (more) unsupported.push({ at: node.start!, ...more });
	}
	return { typed, unsupported: unsupported.toSorted((a, b) => a.at - b.at) };
}

/** Node's warning that its stripper is experimental. */
const EXPERIMENTAL = (warning: string, type: unknown): boolean =>
	type === "ExperimentalWarning" && warning.includes("stripTypeScriptTypes");

/**
 * `code` without its types, by Node's `stripTypeScriptTypes`, which keeps every position. Throws
 * the build's message for what is more than a type, with its place in `source`, and for a Node
 * without the stripper.
 *
 * @workaround node-strip-types-experimental kind=tooling delete-when="Node's module.stripTypeScriptTypes is stable in every Node the build supports, and says nothing when it runs"
 */
export function stripMainThreadTypes(
	code: string,
	options: {
		strip: TypeStripper | undefined;
		source: SourceText;
		unsupported: readonly Unsupported[];
	},
): string {
	const { strip, source, unsupported } = options;
	const [refused] = unsupported;
	if (refused) {
		const { at, feature, instead } = refused;
		throw buildError({
			code: "main_thread_function_typescript",
			details: { feature, instead },
			place: placeAt(source, at),
		});
	}
	if (!strip)
		throw buildError({
			code: "typescript_stripper_missing",
			details: { version: nodeVersion() },
			place: placeAt(source, 0),
		});
	try {
		// Node says once per process that the stripper is experimental: not to the app's build.
		return withoutWarnings(EXPERIMENTAL, () => strip(code, { mode: "strip" }));
	} catch (error) {
		throw buildError({
			code: "main_thread_function_typescript",
			details: {
				feature: `TypeScript that is more than a type (${error instanceof Error ? error.message : String(error)})`,
				instead: "JavaScript, or TypeScript with only types",
			},
			place: placeAt(source, 0),
		});
	}
}
