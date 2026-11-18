// A pass of the compile step reads the component's one syntax tree and returns edits against the
// text as written. The edits of every pass are applied together, once, so a pass never sees
// another's output, and every position it reports is the author's.

import type { ComponentAst } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { BuildWarning } from "../diagnostics/messages.ts";
import type { Edit } from "../source-map/edits.ts";

/** What a pass reads. */
export interface PassContext {
	/** The component as written, after its preprocessors. */
	source: string;
	filename: string;
	/** The component's syntax tree, parsed once from `source`. */
	ast: ComponentAst;
	/** The thread this copy of the component is for. */
	thread: Thread;
	/** A development build. */
	development: boolean;
	/**
	 * The module this thread's copy imports Svelte's runtime from, the binding's own; none when the
	 * build gives none, and the component runs on Svelte's.
	 */
	internals?: string | undefined;
	/** The module of the custom renderer, which background components import. */
	renderer?: string | undefined;
	/** The warnings the passes add. */
	warnings: BuildWarning[];
}

/** A pass: the edits it makes, or an error it throws, for a component. */
export type Pass = (context: PassContext) => Edit[];
