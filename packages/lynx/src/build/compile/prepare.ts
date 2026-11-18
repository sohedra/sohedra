// The `prepare` step: every rewrite a component needs before Svelte compiles it, in one go. The
// component is parsed once, each pass reads that one syntax tree and returns edits against the
// text as written, the edits are applied together, and one source map comes out. A pass never
// sees what another wrote, so a function's id, an error's place and the map all come from the
// author's text, whichever passes ran.

import path from "node:path";

import type { ComponentAst } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { BuildWarning } from "../diagnostics/messages.ts";
import { componentFunctions } from "../main-thread-functions/script.ts";
import { applyEdits, pieceMap, pieceText } from "../source-map/edits.ts";
import type { Piece } from "../source-map/edits.ts";
import type { SourceMap } from "../source-map/maps.ts";
import { bareAttributes } from "./bare-attributes.ts";
import { effectImports } from "./effect-imports.ts";
import { eventSpellings } from "./event-spellings.ts";
import { firstFrameEvents } from "./first-frame-events.ts";
import { listItemKeys } from "./list-item-keys.ts";
import type { Pass, PassContext } from "./pass.ts";
import { svelteOptions } from "./svelte-options.ts";
import { threadBranches } from "./thread-branches.ts";

/** What `prepare` reads. */
export interface PrepareOptions {
	/** The component as written, after its preprocessors. */
	source: string;
	filename: string;
	/** The component's syntax tree, parsed once from `source`. */
	ast: ComponentAst;
	thread: Thread;
	development: boolean;
	/** The module this thread's copy imports Svelte's runtime from, when it is the binding's own. */
	internals?: string | undefined;
	/** The app's folder, which the ids of main-thread functions are made relative to. */
	root: string;
	/** Whether to also return source maps. */
	sourceMap: boolean;
}

/** A component ready for Svelte's compiler. */
export interface Prepared {
	/** The component with every pass's edits. */
	code: string;
	/** From `code` to the component as written. */
	map: SourceMap | undefined;
	/** Where an offset in `code` is in the component as written. */
	locate: (offset: number) => number;
	/** What follows the compiled module (the main thread's registrations), and its map. */
	registrations: { code: string; map: SourceMap | undefined };
	/** The ids of the component's main-thread functions, in source order. */
	functionIds: string[];
	/** The warnings the passes add. */
	warnings: BuildWarning[];
}

/** The checks first, then the rewrites. */
const PASSES: readonly Pass[] = [
	svelteOptions,
	eventSpellings,
	bareAttributes,
	firstFrameEvents,
	effectImports,
	listItemKeys,
	threadBranches,
];

/** Run every pass over the component and apply what they return. */
export function prepare(options: PrepareOptions): Prepared {
	const { source, filename, sourceMap } = options;
	const context: PassContext = { ...options, warnings: [] };
	const edits = PASSES.flatMap((pass) => pass(context));
	const functions = componentFunctions(options);
	edits.push(...(functions?.edits ?? []));
	const name = path.basename(filename);
	const edited = applyEdits(source, edits);
	const pieces: Piece[] = functions?.registrations ?? [];
	return {
		code: edited.code,
		map: sourceMap ? edited.map(name) : undefined,
		locate: edited.locate,
		registrations: {
			code: pieceText(source, pieces),
			map: sourceMap && pieces.length > 0 ? pieceMap({ source, pieces, name }) : undefined,
		},
		functionIds: functions?.ids ?? [],
		warnings: context.warnings,
	};
}
